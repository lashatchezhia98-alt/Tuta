# Community privacy rollout

New community uploads use Cloudinary authenticated delivery. Web, native and
moderation pages read photos through an authorization-checked server route.
Legacy uploads remain public at previously shared direct Cloudinary URLs;
proxying them does not revoke those URLs. Before public launch, inventory the
legacy community assets, migrate to authenticated delivery, invalidate the old
URLs, check derivatives, and verify anonymous requests are denied. Do not
change or delete unrelated Cloudinary asset folders.

Deploy the member-block migration before enabling the block UI; verify with
two test accounts that named posts/comments disappear in both directions, and
that anonymous content cannot be correlated through blocking. Confirm the
report queue still displays full text and photos for moderation staff only.
Reship iOS/Android alongside the signed-upload API change: older builds do not
send the authenticated upload type and cannot upload through the new signer.

Account deletion requests are recorded, not fulfilled automatically. Before
accepting real users, validate the deletion workflow across Auth, health rows,
community assets and provider backups. Test a restore in an isolated environment
using approved data access and document recovery and retention expectations.
