import paramiko
import sys

host = "ssh4.vast.ai"
port = 12599
username = "root"
key_filename = r"C:\MneOS\MneOS_New_SSH_Key"
passphrase = "Brita"
local_file = r"C:\MneOS\scripts\Sovereign_Director.py"
remote_file = "/workspace/Sovereign_Director.py"

try:
    print(f"Connecting to {host}:{port} as {username}...")
    key = paramiko.Ed25519Key.from_private_key_file(key_filename, password=passphrase)
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, port=port, username=username, pkey=key)
    
    print("Uploading file...")
    sftp = ssh.open_sftp()
    sftp.put(local_file, remote_file)
    sftp.close()
    
    print("Upload successful!")
    ssh.close()
except Exception as e:
    print(f"Error: {e}")
