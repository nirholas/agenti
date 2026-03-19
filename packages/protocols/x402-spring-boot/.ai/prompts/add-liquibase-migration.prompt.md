# add-liquibase-migration.prompt.md

You are working in a Mogami Java / Spring Boot repository that uses Liquibase XML migrations.

Your task is to create **one new Liquibase migration file** that follows the existing project conventions exactly.

## Objective

Given a functional requirement, generate:

1. the new Liquibase XML migration file
2. the file name
3. the `<changeSet>` id
4. a short explanation of what was added

Do **not** generate Java code unless explicitly requested.
Do **not** modify existing migrations.
Do **not** rewrite older files.
Create a **new migration only**.

---

# Project conventions to follow

## 1. General style

Follow these conventions strictly:

- Use **Liquibase XML**
- Use this XML header:

```xml
<?xml version="1.1" encoding="UTF-8" standalone="no"?>
<databaseChangeLog xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
                   xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog https://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.4.xsd">
```

- Close with:

```xml
</databaseChangeLog>
```

- Use **one main `changeSet`** unless there is a very good reason to split
- The `author` must be:

```xml
author="straumat"
```

## 2. changeSet id format

Use this format:

```text
<version>-<object-type>-<object-name>
```

Examples:
- `2.0.0-table-outbox_event`
- `2.0.1-index-payment_status`
- `2.1.0-column-payment-created_at`

Rules:
- lowercase
- words separated by `-`
- object names in lowercase
- concise but explicit

## 3. SQL naming conventions

Use these conventions:

- table names: `UPPER_SNAKE_CASE`
- column names: `UPPER_SNAKE_CASE`
- constraint names: explicit, uppercase
- index names: explicit, uppercase

Examples:
- `OUTBOX_EVENT`
- `EVENT_ID`
- `PK_OUTBOX_EVENT`
- `UNIQUE_OUTBOX_EVENT_EVENT_ID`
- `INDEX_OUTBOX_EVENT_STATUS_AND_CREATED_AT`

## 4. Documentation in migration

Add `remarks` whenever useful:
- table remarks
- column remarks

Remarks must be short, explicit, and useful.

## 5. IDs and auto increment

When creating a table with a numeric primary key, follow this style:

- create the `ID` column in `createTable`
- mark it as primary key
- then use a separate `addAutoIncrement`

Example:

```xml
<column name="ID" type="BIGINT" remarks="Internal unique identifier">
    <constraints nullable="false" primaryKey="true" primaryKeyName="PK_EXAMPLE"/>
</column>
```

Then:

```xml
<addAutoIncrement tableName="EXAMPLE"
                  columnName="ID"
                  columnDataType="BIGINT"
                  startWith="1"/>
```

## 6. Indexes

Create indexes explicitly when they support:
- uniqueness
- lookup by business id
- status processing
- sorting by creation date
- foreign key access
- scheduler / outbox polling

Index names must be explicit.

## 7. Constraints

Be explicit with constraints:
- `nullable="false"` where required
- unique constraints must be named
- primary key names must be explicit

## 8. What to avoid

Do not:
- modify an old migration
- use vague names
- omit important indexes
- generate raw SQL unless explicitly requested
- generate rollback unless explicitly requested
- invent naming conventions that differ from the repository style
- use lowercase table or column names
- create multiple unrelated changes in the same migration

---

# Existing repository style reference

The repository already contains migrations like this style:

- XML Liquibase 4.4 schema
- explicit `remarks`
- uppercase table and column names
- explicit primary key / unique / index names
- separate `addAutoIncrement`
- concise comments only when useful

Use that exact style as the baseline.

---

# What I will give you

I will describe a schema change such as:

- create a new table
- add a column
- rename a column
- add an index
- add a unique constraint
- add a foreign key
- create a join table
- extend an enum-like string column
- add technical columns like `CREATED_AT`, `UPDATED_AT`, `LOCKED_AT`, etc.

---

# What you must return

Return your answer in exactly this structure.

## 1. File name

Provide a file name in a style like:

```text
create_payment_table.xml
```

If I already gave you a naming convention for file names, follow it.
Otherwise use a clear versioned file name.

## 2. changeSet id

Provide the `changeSet` id separately.

## 3. Migration XML

Provide the full XML migration in one code block.

## 4. Notes

Provide a very short explanation of:
- what was created or changed
- which indexes / constraints were added
- any assumption you made

Keep the notes short.

---

# Decision rules

## If the request is to create a table

You should usually think about:
- primary key
- business id
- status column if relevant
- payload / content columns
- created / updated timestamps if relevant
- lock columns if relevant
- processing indexes if the table is polled
- unique constraint if a business key exists

## If the request is to add a column

You must think about:
- nullability
- default value or backfill risk
- whether an index is needed
- whether the column is technical or business data
- whether the migration is safe for existing rows

If a non-null column is requested on an existing populated table, do **not** silently generate a risky migration.
Prefer one of these approaches:
- add nullable column first
- backfill
- then make non-null
- or explicitly state the assumption that the table is empty

## If the request is to add a foreign key

You must:
- name the foreign key explicitly
- consider adding an index on the foreign key column
- use repository naming conventions

## If the request is to support polling / scheduling / outbox processing

You must think about:
- status index
- created date ordering index
- lock columns if concurrency matters
- business id uniqueness if deduplication matters

---

# Style rules for generated XML

- Indentation must be clean and consistent
- Keep the XML readable
- Keep comments minimal
- Prefer explicitness over compactness
- Do not produce pseudo-code
- Produce valid Liquibase XML

---

# Example of expected behavior

If I ask:

> Add a new table to store payment traces with a unique trace id, a status, a payload, a created_at timestamp and an index for polling by status and created_at.

You should produce:
- a versioned file name
- a `changeSet` id like `2.0.0-table-payment_trace`
- a full Liquibase XML migration
- explicit names like:
    - `PAYMENT_TRACE`
    - `TRACE_ID`
    - `PK_PAYMENT_TRACE`
    - `UNIQUE_PAYMENT_TRACE_TRACE_ID`
    - `INDEX_PAYMENT_TRACE_STATUS_AND_CREATED_AT`

---

# Final instruction

Do not explain Liquibase.
Do not give high-level advice.
Generate the migration directly, following the repository conventions exactly.