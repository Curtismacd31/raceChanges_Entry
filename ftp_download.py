# ftp_list.py
from ftplib import FTP
import json

FTP_HOST = "p1.standardbredcanada.com"
FTP_USER = "pba470ft"
FTP_PASS = "p72vr9xz3"
TARGET_DIR = "CTA2$DISK:[PRIPRD.LGI.PBA470FT]"

def list_files():
    try:
        ftp = FTP()
        ftp.connect(FTP_HOST, 21, timeout=10)
        ftp.login(FTP_USER, FTP_PASS)
        ftp.cwd(TARGET_DIR)

        files = ftp.nlst()
        # Filter and strip trailing `;1`
        clean = [f.split(";")[0] for f in files if f.lower().endswith(".zip;1")]

        ftp.quit()

        print(json.dumps(clean))  # ✅ Output to stdout for Node to capture

    except Exception as e:
        print(json.dumps({ "error": str(e) }))

if __name__ == "__main__":
    list_files()
