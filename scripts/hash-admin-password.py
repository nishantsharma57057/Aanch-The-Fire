"""Run python3 scripts/hash-admin-password.py; enter password privately at prompt."""
import getpass
import hashlib
import secrets
password = getpass.getpass('New admin password: ')
confirm = getpass.getpass('Confirm password: ')
if password != confirm or len(password) < 10:
    raise SystemExit('Passwords must match and contain at least 10 characters.')
salt = secrets.token_hex(16)
print('ADMIN_PASSWORD_HASH=' + salt + ':' + hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 100000).hex())
