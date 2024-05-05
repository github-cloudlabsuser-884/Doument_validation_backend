# Document_validation_backend
Document_validation_backend

# Document Validation Backend

This Node.js application serves as the backend for a document validation system in the banking sector. It provides endpoints for uploading documents, performing Optical Character Recognition (OCR), and validating document data against a Cosmos DB.

## Technologies Used

- Express.js: Backend framework for handling HTTP requests and routing.
- Multer: Middleware for handling multipart/form-data, used for file uploads.
- Azure Cognitive Services: Utilized for Optical Character Recognition (OCR) to extract text from documents.
- Azure Cosmos DB: NoSQL database used for storing document data and validating Aadhar numbers.
- OpenAI API: Integrated for text processing and conversation handling.

## Features

### Document Upload and OCR

- Users can upload documents in various formats (e.g., PDF, DOC, PNG).
- The backend performs OCR to extract text data from uploaded documents.

### Data Extraction

- Extracted data, including name, date of birth and Aadhar number is parsed from OCR results.

### Aadhar Number Validation

- Extracted Aadhar numbers are validated against a Cosmos DB to check for existing entries.

### Conversation Handling

- Integration with OpenAI API allows for conversation handling with the frontend chatbot.

## Usage

To run the application locally, follow these steps:

1. Clone this repository.
2. Install dependencies using `npm install`.
3. Set up environment variables in a `.env` file:
   - `VISION_KEY`: Azure Cognitive Services API key for Computer Vision.
   - `VISION_ENDPOINT`: Azure Cognitive Services endpoint URL.
   - Cosmos DB endpoint and key.
   - OpenAI API key.
4. Start the server with `npm start`.
5. Access the API endpoints from the frontend application.

## API Endpoints

- `POST /api/upload-document`: Endpoint for uploading documents and initiating validation.
- Modify this endpoint to handle document uploads and perform OCR.
- Add route handlers for other functionalities as needed.

- `POST /api/send-message`: Endpoint for sending messages to the chatbot and receiving responses.
-  Wait for the response from the chatbot.
-  Receive and handle the response from the API.

## Note

- Ensure that all necessary dependencies are installed and environment variables are configured properly for the application to function correctly.


