from app import create_app
from app.models.paymentOut import PaymentOut

app = create_app()
with app.app_context():
    # Check if there are any payment records at all
    total_count = PaymentOut.query.count()
    print(f'Total payment records: {total_count}')
    
    # Check soft deleted records
    deleted_count = PaymentOut.query.filter(PaymentOut.is_deleted == True).count()
    active_count = PaymentOut.query.filter(PaymentOut.is_deleted == False).count()
    print(f'Active records: {active_count}')
    print(f'Deleted records: {deleted_count}')
    
    # Check party names
    payments = PaymentOut.query.filter(PaymentOut.is_deleted == False).limit(5).all()
    print('Sample party names:')
    for p in payments:
        print(f'  - {p.party_name}')
        
    # Test specific party name filter
    test_party = "The Computer Federate"
    filtered = PaymentOut.query.filter(
        PaymentOut.is_deleted == False,
        PaymentOut.party_name.ilike(f"%{test_party}%")
    ).all()
    print(f'Filtered by "{test_party}": {len(filtered)} records')
    for p in filtered:
        print(f'  - {p.party_name} ({p.payment_number})')
