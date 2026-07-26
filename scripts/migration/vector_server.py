import json
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
# Extracted from your existing sweeping script to centralize configuration
VOYAGE_API_KEY = "pa-Pd0jzTCrkPtvT6MqHkFPKHvNWp1YYqXNAkbQrUTaPoj"

class EmbeddingHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/embed':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                text = data.get('text', '')
                
                if not text:
                    self.send_response(400)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(b'{"error": "Missing text"}')
                    return

                # Offload the heavy lifting to the cloud API. VRAM impact: 0 bytes.
                payload = json.dumps({
                    "input": [text],
                    "model": "voyage-large-2-instruct"
                }).encode('utf-8')

                req = urllib.request.Request(VOYAGE_API_URL, data=payload, headers={
                    "Authorization": f"Bearer {VOYAGE_API_KEY}",
                    "Content-Type": "application/json"
                })

                with urllib.request.urlopen(req) as response:
                    api_result = json.loads(response.read().decode('utf-8'))
                    embedding = api_result['data'][0]['embedding']
                    
                    # Ensure 1024d truncate for consistency if Voyage ever shifts dimensions
                    if len(embedding) > 1024:
                        embedding = embedding[:1024]
                
                response_data = json.dumps({"embedding": embedding})
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(response_data.encode('utf-8'))
                print("   ✅ Proxied vectorization to Voyage Cloud successfully.")
            except Exception as e:
                print(f"   ❌ Proxy error: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Mute default HTTP server logging to keep terminal clean
        pass

def run(server_class=HTTPServer, handler_class=EmbeddingHandler, port=5005):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print("=========================================")
    print("🛡️ GPU SAFE MODE ENGAGED: PyTorch Banished")
    print("=========================================")
    print(f"🚀 Sovereign Vector Proxy listening on http://localhost:{port}/embed")
    print("   -> Forwarding queries to Voyage Cloud API")
    print("   -> Local VRAM footprint: ZERO")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print("Server stopped.")

if __name__ == '__main__':
    run()
