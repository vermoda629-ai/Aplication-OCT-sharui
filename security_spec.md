# Security Specification - SHARUI Inventory & Sales

## Data Invariants
1. A user can only access their own products, logs, sales, and invoices.
2. Every document must have an `ownerId` that matches the authenticated user's `uid`.
3. `id` and `ownerId` are immutable once created.
4. `createdAt` must be tracked properly.
5. `price`, `amount`, and `total` must be non-negative.

## The Dirty Dozen Payloads
1. **P1 (Identity Spoofing)**: Create product with `ownerId` of another user.
2. **P2 (Privilege Escalation)**: Update product to change `ownerId` to yourself from another owner.
3. **P3 (ID Poisoning)**: Create document with an ID longer than 128 characters.
4. **P4 (Resource Poisoning)**: Create product with oversized field.
5. **P5 (State Shortcutting)**: Update sale `status` to an invalid value outside the enum.
6. **P6 (Immutable Breach)**: Update `ownerId` after initial creation.
7. **P7 (Unauthenticated Read)**: Read products without being logged in.
8. **P8 (Cross-User Read)**: Read another user's sales.
9. **P9 (Blanket Query)**: Perform a list query without the user filter.
10. **P10 (Negative Money)**: Create a sale with a price of -100.
11. **P11 (Type Poisoning)**: Update `price` with a string instead of a number.
12. **P12 (Orphaned Write)**: Write to undefined collections or root documents.
