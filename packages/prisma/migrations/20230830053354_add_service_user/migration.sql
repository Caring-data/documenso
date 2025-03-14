INSERT INTO "User" ("email", "name") VALUES (
  'serviceaccount@caringdata.com',
  'Service Account'
) ON CONFLICT DO NOTHING;
