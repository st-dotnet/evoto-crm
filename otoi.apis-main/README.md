# Flask SaaS Application

A SaaS-based Flask application with user management, business management, and advanced features like filtering, sorting, and pagination. This application uses PostgreSQL as the database and Flask-SQLAlchemy for ORM.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Setup Instructions](#setup-instructions)
- [Database Management](#database-management)
- [Running the Application](#running-the-application)
- [Testing the Application](#testing-the-application)
- [Usage Commands](#usage-commands)
- [Dummy Data](#dummy-data)

---

## Features

- User and Business Management with a many-to-many relationship.
- Advanced query support:
  - Filtering
  - Sorting
  - Pagination
- PostgreSQL database integration.
- Swagger UI for API documentation.
- Virtual environment setup for dependency isolation.

---

## Requirements

- Python 3.8+
- PostgreSQL
- pip (Python package installer)

---

## Setup Instructions

### 1. Clone the Repository
bash
git clone <repository_url>
cd <repository_folder>


### 2. Create a Virtual Environment
bash
python -m venv venv


### 3. Activate the Virtual Environment
- *macOS/Linux*:
  bash
  source venv/bin/activate
  
- *Windows*:
  bash
  venv\Scripts\activate
  

### 4. Install Dependencies
bash
pip install -r requirements.txt


---

## Database Management

### 1. Initialize Migrations
bash
flask db init


### 2. Generate Migrations
bash
flask db migrate -m "Initial migration"


### 3. Apply Migrations
bash
flask db upgrade


---

## Running the Application
### 1. Start the Application
bash
flask run


### 2. Access the Application
- *API Base URL*: http://127.0.0.1:5000
- *Swagger UI*: http://127.0.0.1:5000/apidocs

---

## Testing the Application

### Fetch Persons with Filtering, Sorting, and Pagination
bash
curl -X GET "http://127.0.0.1:5000/persons/?first_name=John&sort=-id&page=1&per_page=5"


---

## Steps to Debug a Flask App in VS Code:
### Use the Correct Launch Configuration

- *Open your project in VS Code.*
- *Go to the Run and Debug view (Ctrl+Shift+D or click on the debug icon).*
- *Add configuration file if it doesn't exist.*
- *Choose Flask when prompted.*
- *Select start up file. In our case it is run.py. Or Update the "FLASK_APP" value with the name of your Flask app entry point (e.g., main.py or application.py or run.py).*

VS Code will generate a launch.json file with the following configuration:

```JSON
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python: Flask",
            "type": "python",
            "request": "launch",
            "module": "flask",
            "env": {
                "FLASK_APP": "app.py",
                "FLASK_ENV": "development"
            },
            "args": [
                "run",
                "--no-debugger",
                "--no-reload"
            ],
            "jinja": true
        }
    ]
}
```
Go to run and start debugging or press F5 to debug your applicaiton. Place debug point where you want to debug your code.

---
## Usage Commands

### Flask-Specific Commands
bash
flask run                     # Run the application
flask db init                 # Initialize migrations
flask db migrate -m "Message" # Generate migration file
flask db upgrade              # Apply migrations
flask db downgrade            # Rollback migrations


### Virtual Environment Commands
bash
python -m venv venv           # Create virtual environment
source venv/bin/activate      # Activate (macOS/Linux)
venv\Scripts\activate         # Activate (Windows)
deactivate                    # Deactivate virtual environment


### Package Management
bash
pip install <package-name>    # Install a package
pip install --upgrade pip     # Upgrade pip
pip cache purge               # Clear pip cache
pip show flask                # Check Flask version


---

## Dummy Data

### Insert into person Table
sql
INSERT INTO person (id, first_name, last_name, person_type_id, mobile, email, gst)
VALUES 
(1, 'John', 'Doe', 1, '1234567890', 'john.doe@example.com', 'GST123456'),
(2, 'Jane', 'Smith', 2, '9876543210', 'jane.smith@example.com', 'GST654321');


### Insert into user_business Table
sql
INSERT INTO "user_business" (user_id, business_id)
VALUES
(1, 1),
(1, 2),
(2, 3);


---

## Database Verification Commands

### PostgreSQL Commands
bash
\dt                        # List all tables
SELECT * FROM person;      # View data in the person table
SELECT * FROM user_business; # View associations


### SQLite Commands
bash
.tables                    # List tables in SQLite


---