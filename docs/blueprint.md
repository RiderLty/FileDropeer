# **App Name**: FileDrop Zone

## Core Features:

- Initial Configuration: On first visit, prompt user for API token and backend URL and save in local storage.
- File Selection: Enable users to drag and drop files into designated area on the page, or choose file by clicking a button.
- File Upload: Use Javascript fetch API with a POST request to upload the file to the specified backend URL. Include the API token in the request headers.
- Upload Progress: Provide a visual progress indicator during the upload process.
- Upload Status: Display a confirmation message upon successful upload, or an error message if the upload fails.
- Smart Suggestions: Use generative AI to provide suggested filenames to user to increase chances of successful retrieval; LLM uses token as tool, with filenames stored in localStorage and passed to backend.

## Style Guidelines:

- Primary color: Strong purple (#9D4EDD) to invoke sophistication, combined with accessibility.
- Background color: Light purple (#E9D5FF), a very desaturated version of the primary to complement the bright purple without distraction.
- Accent color: Deep blue (#2973B7), to contrast and emphasize actions.
- Font: 'Inter' (sans-serif) for a clean, modern user experience; suitable for both headlines and body text
- Use clear and intuitive icons to represent file types and upload status.
- Design a clean and drag-and-drop interface, highlighting the drag area and upload button prominently.
- Implement smooth transition effects for feedback such as progress updates or success/error messages.