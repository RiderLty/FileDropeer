import asyncio
import os
import struct
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Header
from typing import Annotated
import uuid

app = FastAPI()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

CHUNK_SIZE = 4 * 1024 * 1024  # 4MB

# This is a dummy token for demonstration purposes.
# In a real application, this should be stored securely, e.g., in an environment variable.
VALID_TOKEN = "in-memory-token"

async def get_token(websocket: WebSocket):
    """Dependency to extract and validate token from the first WebSocket message."""
    try:
        # The first message from the client should be the token.
        message = await websocket.receive_text()
        if message.startswith("Bearer ") and message.split(" ")[1] == VALID_TOKEN:
             # Token is valid, we don't need to do anything else.
             return
    except Exception:
        # Handle cases where client disconnects or sends invalid data
        pass
    
    # If we are here, authentication failed.
    # Send an error message and close the connection.
    error_message = "Error: Authentication failed"
    print(error_message)
    await websocket.send_text(error_message)
    await websocket.close(code=4001, reason="Authentication failed")
    return None


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Annotated[str, Depends(get_token)]):
    await websocket.accept()
    print("WebSocket client connected and authenticated")
    
    file_path = None
    file_writer = None
    remaining_bytes = 0

    try:
        # Second message should be the header
        header_data = await websocket.receive_bytes()

        # |filename_len (4B)| filename (UTF-8) | content_len (8B)|
        if len(header_data) < 12:
            print(f"Error: Header data is too short ({len(header_data)} bytes)")
            await websocket.close(code=1003, reason="Invalid header")
            return

        offset = 0
        filename_len = struct.unpack('!I', header_data[offset:offset+4])[0]
        offset += 4

        if len(header_data) < offset + filename_len + 8:
            print(f"Error: Invalid header format.")
            await websocket.close(code=1003, reason="Invalid header format")
            return

        filename = header_data[offset:offset+filename_len].decode('utf-8')
        offset += filename_len

        content_len = struct.unpack('!Q', header_data[offset:offset+8])[0]
        remaining_bytes = content_len

        sanitized_filename = os.path.basename(filename)
        # To handle multiple uploads of the same filename concurrently
        unique_filename = f"{uuid.uuid4().hex}-{sanitized_filename}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        print(f"Receiving file: {sanitized_filename} ({content_len} bytes) -> {file_path}")

        file_writer = open(file_path, "wb")

        while remaining_bytes > 0:
            chunk = await websocket.receive_bytes()
            if not chunk:
                # This might happen if client disconnects abruptly
                break
            
            file_writer.write(chunk)
            remaining_bytes -= len(chunk)
        
        if remaining_bytes == 0:
            print(f"Successfully received and saved file: {file_path}")
            await websocket.send_text(f"File '{filename}' received successfully.")
        else:
             print(f"Error: File transmission incomplete. Missing {remaining_bytes} bytes.")
             await websocket.send_text(f"Error: File transmission for '{filename}' was incomplete.")


    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"An error occurred: {e}")
        # Try to send an error message if the socket is still open
        if not websocket.client_state.DISCONNECTED:
             await websocket.send_text(f"An error occurred: {e}")
    finally:
        if file_writer:
            file_writer.close()
            # If the upload was not successful, clean up the partial file
            if remaining_bytes > 0 and file_path and os.path.exists(file_path):
                os.remove(file_path)
                print(f"Removed incomplete file: {file_path}")

        # It's good practice to ensure the websocket is closed.
        if not websocket.client_state.DISCONNECTED:
            await websocket.close()
        print("WebSocket connection closed")

if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000, ws_max_size=CHUNK_SIZE * 2)
