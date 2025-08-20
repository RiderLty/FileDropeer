import asyncio
import os
import struct
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

# Create an 'uploads' directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket client connected")
    try:
        while True:
            # Receive the raw binary data
            data = await websocket.receive_bytes()
            
            # |filename_len (4B)| filename (UTF-8) | content_len (8B) | content |
            
            if len(data) < 12:
                print(f"Error: Received data is too short to be a valid file message ({len(data)} bytes)")
                continue

            offset = 0
            
            # 1. Read filename length (4 bytes, big-endian integer)
            filename_len = struct.unpack('!I', data[offset:offset+4])[0]
            offset += 4
            
            if len(data) < offset + filename_len:
                print(f"Error: Invalid filename length. Expecting {filename_len} bytes for filename, but not enough data.")
                continue
                
            # 2. Read filename (UTF-8)
            filename_bytes = data[offset:offset+filename_len]
            filename = filename_bytes.decode('utf-8')
            offset += filename_len
            
            if len(data) < offset + 8:
                print("Error: Not enough data for file content length.")
                continue

            # 3. Read file content length (8 bytes, big-endian long long)
            content_len = struct.unpack('!Q', data[offset:offset+8])[0]
            offset += 8
            
            # 4. Read file content
            content = data[offset:]

            if len(content) != content_len:
                print(f"Error: Mismatch in file content length. Expected {content_len}, got {len(content)}")
                continue

            # Sanitize filename to prevent directory traversal
            sanitized_filename = os.path.basename(filename)
            file_path = os.path.join(UPLOAD_DIR, sanitized_filename)

            # Save the file
            try:
                with open(file_path, "wb") as f:
                    f.write(content)
                print(f"Successfully received and saved file: {file_path} ({len(content)} bytes)")
                # Optional: send a confirmation back to the client
                await websocket.send_text(f"File '{filename}' received successfully.")
            except IOError as e:
                print(f"Error saving file '{filename}': {e}")
                await websocket.send_text(f"Error saving file '{filename}'.")

    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        await websocket.close()
        print("WebSocket connection closed")

if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
