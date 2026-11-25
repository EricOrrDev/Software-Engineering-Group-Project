# Software Engineering 1 Group Project

The schedule:
    Requirements Gathering Week 7
    Functional Spec Week 8
    Prototype Week 9
    Design Doc Week 10


## Team Members
 - Eric Orr
 - Eames
 - Joseph Burke
 - Parker

## Interactive prototype

Open [prototype/dist/index.html](prototype/dist/index.html) in a browser. To serve the prototype locally, run this command from the repository root and open [127.0.0.1:8000](http://127.0.0.1:8000/).

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory prototype/dist
```

### Demo walkthrough

1. Find **Hedge trimmer** in the catalog. Reserve it with Paul’s card `1001`, copy the hold reference, and extend the deadline. You can reopen the hold from **View a hold**.
2. In **Staff workspace**, start checkout for `1001`, confirm ID and age, and sign the sample waiver. Add barcode `T-104` and confirm checkout. The hold shows as picked up and the catalog updates.
3. Try returning an unknown barcode, then look up Cathy’s overdue hex-key set, `T-501`. The late charge is capped at its $5 replacement value. Record a damaged return to see the copy move to maintenance and the incident appear on Cathy’s record.
4. Use the inventory audit queue to review the seeded orbital sander, `T-521`. Save a correction and clear the review flag. You can also add inspected donations and retire worn tools.
5. Reserve the **Tile saw** with Saul’s card `1002` to see why a top-20 tool cannot receive an extension. Advance the demo clock from the staff workspace to release expired holds and inspect the simulated notifications.

### Prototype scope

The catalog and staff workspace share browser-local demo records. Use the seeded card numbers and sample signatures. The county card API, staff authentication, cloud waiver storage, and email delivery are simulated or omitted. The browser checks expiry while the prototype is open and again when it resumes. Popularity ranks are seeded for the demo.

The fee preview models an always-open branch with a 24-hour grace period. It applies the lesser of $20 or replacement value to late fees and uses the same cap when a tool is marked unreturned. Damage is recorded without a separate charge because the charge policy is unspecified.
