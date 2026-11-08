# Private chat retention and doctor photos

Consultation messages expire **48 hours after `created_at`**, independently of
when they are read. Community posts, comments and appointment records are not
chat messages and are not deleted by this policy.

- `/api/care?thread=...` verifies the signed-in participant and queries only
  messages newer than the cutoff. Responses are `private, no-store`.
- Web and native apps keep chat responses in memory only. The shared expiry
  hook prunes messages every second, using server time and monotonic elapsed
  time. Responses from an old account/conversation are discarded.
- Supabase job `tuta-chat-retention-48h` runs every 10 seconds. It permanently
  deletes expired rows from the active `consultation_messages` table. There
  is no message archive, soft-delete body or local offline transcript.
- Its execution history contains operational metadata, not message bodies,
  and is limited to one day for this job only. A timestamp index bounds scans.
- The job requires the database to be running. The API expiry check continues
  to prevent expired rows being returned if cleanup is temporarily delayed.
- Provider backups/WAL have a separate lifecycle. Deleting a database row does
  not erase existing backups, screenshots or copies made by another person.
  The privacy notices explicitly distinguish these from active chat storage.

Only rows in `verified_doctors` can have a profile photo. Ordinary members and
anonymous authors use initials/generic avatars. User-editable authentication
metadata is never used to grant a photo or verification badge. Anonymous doctor
posts must not show a doctor photo or badge.

In `/admin/care`, select a verified doctor to upload/remove one JPG, PNG or WebP
photo (maximum 3 MB). Uploads require the existing admin session and same-origin
check. The server checks image signatures, uploads to Cloudinary, and stores
only the doctor's own namespaced public ID. Member roles cannot change it.
Post attachments and market product photos are separate and remain supported.

## Verification

`tests/chat-policy.test.mjs`, `tests/checkout-race.test.mjs` and
`mobile/tests/chat-retention.test.mjs` cover access control, exact expiry,
clock offsets, photo restrictions, pagination and checkout races.

`tests/database-chat-payment.sql` exercises the actual purge, photo constraints,
role privileges and terminal payment replay guards using temporary fixtures in
a transaction that is rolled back. It must only be run by a database owner.

Existing installations need the updated mobile bundle for client-side expiry;
the deployed server and database rules apply independently of app version.
