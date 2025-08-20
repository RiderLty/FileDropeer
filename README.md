# FileDrop Zone

A modern, secure, and stylish file uploader application built with Next.js, FastAPI, and WebSockets. It provides a seamless user experience for uploading files with features like drag-and-drop, concurrent uploads, and a secure authentication mechanism.

## Features

*   **Drag & Drop Interface**: Easily drag and drop one or multiple files to start uploading.
*   **WebSocket Protocol**: Utilizes WebSockets for efficient, real-time, and stateful file transfer.
*   **Secure Authentication**: Implements a challenge-response mechanism using SHA-256 to secure file uploads against unauthorized access.
*   **Chunked & Asynchronous Backend**: The Python backend handles large files efficiently by receiving and writing them in 4MB chunks asynchronously, minimizing memory usage.
*   **Concurrent Uploads**: Supports up to 8 concurrent file uploads, with a queueing system for additional files.
*   **Dark/Light Mode**: Includes a theme switcher with user preference saved to `localStorage`.
*   **Configurable & Persistent Settings**: Easily configure the backend WebSocket URL and authentication token, with settings saved in `localStorage`.
*   **URL-based Configuration**: Can be pre-configured via URL parameters (`?token=...&backendUrl=...`) for easy sharing and integration, locking the UI to prevent changes.

## Tech Stack

*   **Frontend**: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
*   **Backend**: Python, FastAPI

## Getting Started

Follow these instructions to get the frontend and backend running on your local machine.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v20 or later)
*   [Python](https://www.python.org/) (v3.8 or later)
*   `pip` for Python package management

### Running the Backend Server

1.  **Navigate to the project root directory** in your terminal.

2.  **Install Python dependencies** from `requirements.txt`:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run the FastAPI server**:
    ```bash
    python server.py
    ```
    By default, the backend server will start and listen on `ws://localhost:8000/ws`. It will create an `uploads/` directory in the project root to store uploaded files. The default in-memory token is `in-memory-token`.

### Running the Frontend Application

1.  In a **new terminal**, navigate to the project root directory.

2.  **Install Node.js dependencies**:
    ```bash
    npm install
    ```

3.  **Run the Next.js development server**:
    ```bash
    npm run dev
    ```

4.  **Open the application**:
    Open your web browser and navigate to `http://localhost:9002`.

5.  **Configure the Application**:
    On the first visit, you will be prompted to enter the API Token and WebSocket URL.
    *   **API Token**: `in-memory-token` (or your custom token if you changed it in `server.py`).
    *   **WebSocket URL**: `ws://localhost:8000/ws`

    After saving the configuration, you can start uploading files.
