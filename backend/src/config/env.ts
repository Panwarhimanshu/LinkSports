import dotenv from 'dotenv';
import path from 'path';

// Single shared config: <repo>/.env is used by backend, web and mobile.
// A backend-local .env (e.g. written by setup-vps.sh on the server) still works as a fallback.
// dotenv never overrides variables that are already set, so real environment variables always win.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();
