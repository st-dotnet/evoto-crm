from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
from app.extensions import db
from app.models import PaymentIn, Invoice
from app.utils.stamping import set_updated_fields
from app.utils.decorators import login_required

payment_in_blueprint = Blueprint("payment_in", __name__)

@payment_in_blueprint.route("/<uuid:payment_id>", methods=["DELETE"])
@login_required
def delete_payment(payment_id):
    """
    Delete a payment record and update invoice payment status
    ---
    tags:
      - Payment In
    parameters:
      - name: payment_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Payment deleted successfully
      404:
        description: Payment not found
      400:
        description: Cannot delete payment
    """
    print(f"PAYMENT-IN DELETION ROUTE CALLED - Payment ID: {payment_id}")
    try:
        # Debug: Check if payment exists
        payment = PaymentIn.query.filter_by(uuid=payment_id, is_deleted=False).first()
        print(f"PAYMENT-IN SEARCH RESULT: {payment}")
        
        # Debug: Check all payments
        all_payments = PaymentIn.query.all()
        print(f"ALL PAYMENTS IN DB: {[{'uuid': str(p.uuid), 'is_deleted': p.is_deleted} for p in all_payments]}")
        
        if not payment:
            print("PAYMENT-IN NOT FOUND - Returning 404")
            return jsonify({"error": "Payment not found"}), 404
        
        # Get the associated invoice
        invoice = Invoice.query.filter_by(uuid=payment.invoice_id).first()
        if not invoice:
            return jsonify({"error": "Associated invoice not found"}), 404
        
        # Store payment amount before deletion
        payment_amount = float(payment.amount_received)
        
        # Soft delete payment
        payment.is_deleted = True
        set_updated_fields(payment)
        
        # Update invoice payment status
        old_amount_paid = float(invoice.amount_paid)
        old_balance_due = float(invoice.balance_due)
        old_payment_status = invoice.payment_status
        
        invoice.amount_paid = max(0, float(invoice.amount_paid) - payment_amount)
        
        # Recalculate payment_discount from remaining (non-deleted) payments
        remaining_payments = PaymentIn.query.filter_by(invoice_id=invoice.uuid, is_deleted=False).all()
        total_discount = sum(float(p.discount or 0) for p in remaining_payments)
        invoice.payment_discount = total_discount
        
        print(f"PAYMENT-IN DELETION - Remaining payments count: {len(remaining_payments)}")
        print(f"PAYMENT-IN DELETION - Recalculated total_discount: {total_discount}")
        print(f"PAYMENT-IN DELETION - Invoice payment_discount updated to: {invoice.payment_discount}")
        
        invoice.balance_due = float(invoice.total_amount) - float(invoice.amount_paid) - float(invoice.payment_discount or 0)
        
        # Update payment status based on remaining balance
        if invoice.balance_due <= 0:
            invoice.payment_status = "paid"
        elif invoice.amount_paid > 0:
            invoice.payment_status = "partial"
        else:
            invoice.payment_status = "unpaid"
            
        # Debug logging
        print(f"PAYMENT-IN DELETION - Invoice UUID: {invoice.uuid}")
        print(f"PAYMENT-IN DELETION - Old amount_paid: {old_amount_paid}, New amount_paid: {invoice.amount_paid}")
        print(f"PAYMENT-IN DELETION - Old balance_due: {old_balance_due}, New balance_due: {invoice.balance_due}")
        print(f"PAYMENT-IN DELETION - Old payment_status: {old_payment_status}, New payment_status: {invoice.payment_status}")
        
        set_updated_fields(invoice)
        db.session.commit()
        
        return jsonify({
            "message": "Payment deleted successfully",
            "invoice_payment_status": invoice.payment_status,
            "amount_paid": float(invoice.amount_paid),
            "balance_due": float(invoice.balance_due)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"PAYMENT-IN DELETION ERROR: {str(e)}")
        return jsonify({"error": "Failed to delete payment", "details": str(e)}), 500

@payment_in_blueprint.route("/test-create", methods=["POST"])
def test_create_payment():
    """Create a test payment record for testing"""
    try:
        from app.models.invoice import Invoice
        from datetime import datetime
        
        # Find an invoice to link to
        invoice = Invoice.query.filter_by(is_deleted=False).first()
        if not invoice:
            return jsonify({"error": "No invoices found to create test payment"}), 404
        
        # Generate payment number
        payment_count = PaymentIn.query.filter_by(invoice_id=str(invoice.uuid)).count()
        payment_number = f"PAY-{invoice.invoice_number}-{payment_count + 1}"
        
        # Create test payment
        payment_in = PaymentIn(
            payment_number=payment_number,
            payment_date=datetime.now().strftime("%Y-%m-%d"),
            invoice_id=str(invoice.uuid),
            party_name="Test Customer",
            invoice_number=invoice.invoice_number,
            total_amount=float(invoice.total_amount),
            amount_received=1000.0,
            balance_due=float(invoice.total_amount) - 1000.0,
            discount=0.0,
            payment_mode="Cash",
            business_id=invoice.business_id
        )
        
        db.session.add(payment_in)
        db.session.commit()
        
        return jsonify({
            "message": "Test payment created successfully",
            "payment_uuid": str(payment_in.uuid),
            "payment_number": payment_in.payment_number,
            "invoice_number": invoice.invoice_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create test payment", "details": str(e)}), 500

@payment_in_blueprint.route("/debug/list", methods=["GET"])
def debug_list_payments():
    """Debug endpoint to list all payment UUIDs"""
    try:
        payments = PaymentIn.query.all()
        payment_list = []
        
        for payment in payments:
            payment_list.append({
                "uuid": str(payment.uuid),
                "payment_number": payment.payment_number,
                "invoice_number": payment.invoice_number,
                "amount_received": float(payment.amount_received),
                "balance_due": float(payment.balance_due),
                "payment_status": payment.payment_status,
                "is_deleted": payment.is_deleted,
                "invoice_id": str(payment.invoice_id)
            })
        
        return jsonify({
            "total_payments": len(payment_list),
            "payments": payment_list
        }), 200
        
    except Exception as e:
        return jsonify({"error": "Failed to list payments", "details": str(e)}), 500

@payment_in_blueprint.route("/invoice/<uuid:invoice_id>", methods=["DELETE"])
@login_required
def delete_payments_by_invoice(invoice_id):
    """
    Delete ALL payment records for a specific invoice and update invoice payment status
    ---
    tags:
      - Payment In
    parameters:
      - name: invoice_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: All payments deleted successfully
      404:
        description: No payments found for invoice
    """
    print(f"PAYMENT-IN DELETION BY INVOICE - Invoice ID: {invoice_id}")
    try:
        # Find all payments for this invoice
        payments = PaymentIn.query.filter_by(invoice_id=str(invoice_id), is_deleted=False).all()
        print(f"FOUND {len(payments)} PAYMENTS FOR INVOICE")
        
        if not payments:
            print("NO PAYMENTS FOUND FOR INVOICE - Returning 404")
            return jsonify({"error": "No payments found for invoice"}), 404
        
        # Get the associated invoice
        invoice = Invoice.query.filter_by(uuid=str(invoice_id)).first()
        if not invoice:
            return jsonify({"error": "Associated invoice not found"}), 404
        
        # Store total payment amount before deletion
        total_payment_amount = sum(float(p.amount_received) for p in payments)
        
        # Soft delete all payments
        for payment in payments:
            payment.is_deleted = True
            set_updated_fields(payment)
            print(f"DELETED PAYMENT: {payment.payment_number}")
        
        # Update invoice payment status
        old_amount_paid = float(invoice.amount_paid)
        old_balance_due = float(invoice.balance_due)
        old_payment_status = invoice.payment_status
        
        invoice.amount_paid = max(0, float(invoice.amount_paid) - total_payment_amount)
        
        # Since all payments are being deleted, set payment_discount to 0
        invoice.payment_discount = 0
        
        invoice.balance_due = float(invoice.total_amount) - float(invoice.amount_paid) - float(invoice.payment_discount or 0)
        
        # Update payment status based on remaining balance
        if invoice.balance_due <= 0:
            invoice.payment_status = "paid"
        elif invoice.amount_paid > 0:
            invoice.payment_status = "partial"
        else:
            invoice.payment_status = "unpaid"
            
        # Debug logging
        print(f"PAYMENT-IN DELETION BY INVOICE - Invoice UUID: {invoice.uuid}")
        print(f"PAYMENT-IN DELETION BY INVOICE - Total payment amount: {total_payment_amount}")
        print(f"PAYMENT-IN DELETION BY INVOICE - Old amount_paid: {old_amount_paid}, New amount_paid: {invoice.amount_paid}")
        print(f"PAYMENT-IN DELETION BY INVOICE - Old balance_due: {old_balance_due}, New balance_due: {invoice.balance_due}")
        print(f"PAYMENT-IN DELETION BY INVOICE - Old payment_status: {old_payment_status}, New payment_status: {invoice.payment_status}")
        
        db.session.commit()
        
        return jsonify({
            "message": f"Deleted {len(payments)} payment(s) successfully",
            "invoice_uuid": str(invoice.uuid),
            "invoice_number": invoice.invoice_number,
            "total_amount_deleted": total_payment_amount,
            "updated_amount_paid": float(invoice.amount_paid),
            "updated_balance_due": float(invoice.balance_due),
            "updated_payment_status": invoice.payment_status
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"PAYMENT-IN DELETION BY INVOICE ERROR: {str(e)}")
        return jsonify({"error": "Failed to delete payments", "details": str(e)}), 500
