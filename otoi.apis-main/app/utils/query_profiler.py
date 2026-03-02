"""
Query Profiler Utility
======================
Tracks SQL queries per request, identifies slow queries (>100ms),
and warns about potential N+1 query patterns.

Usage:
    from app.utils.query_profiler import init_profiler

    # In app/__init__.py inside create_app():
    init_profiler(app, slow_query_threshold=0.1)

After enabling, every API response will include these headers:
    X-Query-Count   — number of DB queries made in this request
    X-Query-Time    — total DB time in seconds
    X-Request-Time  — total request wall-clock time in seconds
"""

import time
import logging
from flask import g, request, has_request_context
from sqlalchemy import event
from sqlalchemy.engine import Engine

# ──────────────────────────────────────────
# Logger
# ──────────────────────────────────────────
logger = logging.getLogger("query_profiler")
logger.setLevel(logging.DEBUG)

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("[PROFILER] %(asctime)s %(levelname)s — %(message)s",
                          datefmt="%Y-%m-%d %H:%M:%S")
    )
    logger.addHandler(handler)


# ──────────────────────────────────────────
# SQLAlchemy event listeners
# ──────────────────────────────────────────

@event.listens_for(Engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Stamp the start time on the connection object before the query runs."""
    conn.info.setdefault("query_start_time", []).append(time.perf_counter())


@event.listens_for(Engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """
    After each query:
      - Calculate duration
      - Log slow queries
      - Accumulate counts & total time on Flask g (if inside a request context)
    """
    start = conn.info["query_start_time"].pop()
    duration = time.perf_counter() - start  # seconds

    # Accumulate on Flask g (only inside a request context)
    try:
        if not hasattr(g, "_query_count"):
            g._query_count = 0
            g._query_time = 0.0
            g._query_log = []

        g._query_count += 1
        g._query_time += duration
        g._query_log.append((duration, statement))
    except RuntimeError:
        # Outside of a Flask request context — skip silently
        pass

    # Log slow queries immediately

    threshold = getattr(_before_cursor_execute, "_slow_threshold", 0.1)

    if duration > threshold:
        if has_request_context():
            method = request.method
            path = request.path
        else:
            method = "-"
            path = "NO_REQUEST_CONTEXT"
    else:
        method = "-"
        path = "NO_REQUEST_CONTEXT"

    logger.warning(
        "SLOW QUERY (%.3fs)\n"
        "  Endpoint : %s %s\n"
        "  SQL      : %s",
        duration,
        method,
        path,
        statement[:500].replace("\n", " "),
    )    


# ──────────────────────────────────────────
# Flask app integration
# ──────────────────────────────────────────

def init_profiler(app, slow_query_threshold: float = 0.1):
    """
    Register query-profiling hooks on a Flask application.

    Args:
        app:                    The Flask application instance.
        slow_query_threshold:   Queries slower than this (seconds) are logged
                                as warnings. Default is 0.1 s (100 ms).

    Example:
        init_profiler(app, slow_query_threshold=0.05)   # warn at 50 ms
    """
    # Store threshold where the after_execute listener can read it
    _before_cursor_execute._slow_threshold = slow_query_threshold

    @app.before_request
    def _start_timer():
        g._request_start = time.perf_counter()
        g._query_count = 0
        g._query_time = 0.0
        g._query_log = []

    @app.after_request
    def _add_profiling_headers(response):
        query_count = getattr(g, "_query_count", 0)
        query_time  = getattr(g, "_query_time", 0.0)
        request_time = time.perf_counter() - getattr(g, "_request_start", time.perf_counter())

        # Add performance metadata to every response
        response.headers["X-Query-Count"] = str(query_count)
        response.headers["X-Query-Time"]  = f"{query_time:.4f}"
        response.headers["X-Request-Time"] = f"{request_time:.4f}"

        # Warn about potential N+1 query situations
        if query_count > 20:
            logger.warning(
                "N+1 SUSPECTED — %d queries in %.3fs for %s %s",
                query_count, query_time,
                request.method, request.path,
            )
        elif query_count > 10:
            logger.info(
                "HIGH QUERY COUNT — %d queries in %.3fs for %s %s",
                query_count, query_time,
                request.method, request.path,
            )

        # Summary log for every request (DEBUG level — won't appear in production)
        logger.debug(
            "%s %s → %d queries / %.3fs DB / %.3fs total",
            request.method, request.path,
            query_count, query_time, request_time,
        )

        return response

    logger.info(
        "Query profiler enabled (slow query threshold: %.0fms)",
        slow_query_threshold * 1000,
    )


# ──────────────────────────────────────────
# Standalone helper — use in tests / scripts
# ──────────────────────────────────────────

class QueryProfiler:
    """
    Context manager for profiling a block of code outside of a Flask request.

    Example:
        with QueryProfiler() as p:
            results = Customer.query.all()
        print(f"Queries: {p.query_count}, Time: {p.total_time:.3f}s")
    """

    def __init__(self):
        self.query_count = 0
        self.total_time  = 0.0
        self._queries    = []

    def __enter__(self):
        event.listen(Engine, "before_cursor_execute", self._before)
        event.listen(Engine, "after_cursor_execute",  self._after)
        return self

    def __exit__(self, *_):
        event.remove(Engine, "before_cursor_execute", self._before)
        event.remove(Engine, "after_cursor_execute",  self._after)

    def _before(self, conn, cursor, statement, parameters, context, executemany):
        conn.info.setdefault("_profiler_start", []).append(time.perf_counter())

    def _after(self, conn, cursor, statement, parameters, context, executemany):
        start    = conn.info["_profiler_start"].pop()
        duration = time.perf_counter() - start
        self.query_count += 1
        self.total_time  += duration
        self._queries.append({"sql": statement, "duration": duration})

    def report(self):
        """Print a human-readable query report."""
        print(f"\n{'='*60}")
        print(f"  Query Report: {self.query_count} queries in {self.total_time:.3f}s")
        print(f"{'='*60}")
        for i, q in enumerate(self._queries, 1):
            print(f"  [{i:02d}] {q['duration']*1000:.1f}ms  {q['sql'][:120].replace(chr(10), ' ')}")
        print(f"{'='*60}\n")

    @property
    def slowest(self):
        """Return the single slowest query dict."""
        return max(self._queries, key=lambda q: q["duration"]) if self._queries else None
