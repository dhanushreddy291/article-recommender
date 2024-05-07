import os
import psycopg2

from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    conn = psycopg2.connect(
        user=os.getenv("DB_USER"),
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        port=os.getenv("DB_PORT"),
        password=os.getenv("DB_PASSWORD"),
        sslmode="require",
        sslrootcert=os.getenv("SSLROOTCERT"),
    )
    conn.autocommit = True
    return conn
