
require('dotenv').config();
const express = require('express');
const app = express();
const multer = require('multer');
const upload = multer();
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { CosmosClient } = require('@azure/cosmos'); // Add Cosmos DB client
app.use(express.json());
const OpenAI = require('openai-api');


// Initialize Cosmos DB client
const cosmosClient = new CosmosClient({
  cosmos_endpoint: process.env["COSMOSDB_ENDPOINT"],
  cosmos_key: process.env["COSMOSDB_KEY"],
});
const openai = new OpenAI('AZURE_API_KEY');
const key = process.env["VISION_KEY"];
const endpoint = process.env["VISION_ENDPOINT"];
const credentials = new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } });
const computerVisionClient = new ComputerVisionClient(credentials, endpoint);
const databaseId = 'OCRDB';
const containerId = 'OCRContainer';
const path = require('path');
// Define the sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// Create a new instance of the OpenAI API client with your API key


app.use('/temp', express.static(path.join(__dirname, 'temp')));
app.post('/api/upload-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      throw new Error('File data is missing in the request');
    }
 
    const fileData = req.file.buffer;
 
    const extractedData = await recognizeText(fileData);
 
    // Extract Aadhar number from OCR result
    const { AadharNumber } = extractedData;
 
    // Query Cosmos DB to check if Aadhar number exists
    const query = {
      query: "SELECT * FROM c WHERE c.AadharNumber = @AadharNumber",
      parameters: [{ name: "@AadharNumber", value: AadharNumber }]
    };
 
    const { resources } = await cosmosClient.database(databaseId).container(containerId).items.query(query).fetchAll();
    console.log(resources.length);
    if (resources.length > 0) {
      // Aadhar number exists in Cosmos DB
      const documentUrl = saveTempFile(fileData, req.file.originalname);
      // Construct the URL to the file relative to the 'temp' directory
       // Print the uploaded document in the user response
      const relativeFilePath = `/${documentUrl}`;
      res.json({ message: 'Document validation completed', validationStatus: 'success', data: extractedData, url: documentUrl });
      // console.log({documentUrl});
      // console.log({relativeFilePath});
      //res.json({ message: 'Document validation completed', validationStatus: 'success', data: extractedData});
    } else {
      // Aadhar number does not exist in Cosmos DB
     // res.status(404).json({ message: 'Document validation failed', validationStatus: 'fail' });
      res.json({ message: 'Document validation failed', validationStatus: 'fail'});
    }
     
  } catch (error) {
    console.error('Error uploading document or performing OCR:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
 
app.post('/api/send-message', async (req, res) => {
  try {
    const azureApiKey = process.env["AZURE_API_KEY"];
    const Azure_endpoint = process.env["AZURE_API_ENDPOINT"];
    const client = new OpenAIClient(Azure_endpoint, new AzureKeyCredential(azureApiKey));
    const deploymentId = "text-turbo";
    const deploymentName = "text-turbo";
    const userInput = req.body.message;
    console.log(userInput);
    console.log('Sending message to OpenAI');
 
const conversation = [
  { role: "user", content: "Hi," },
  { role: "assistant", content: "Hello! how can i assist you today?" },
  { role: "user", content: userInput }
];

console.log(`Conversation:`);
conversation.forEach((message) => {
  console.log(`${message.role}: ${message.content}`);
});

const events = await client.streamChatCompletions(deploymentId, conversation, { maxTokens: 128 });

let response = ''; // Initialize an empty string to store the complete response

for await (const event of events) {
  for (const choice of event.choices) {
    const delta = choice.delta?.content;
    if (delta !== undefined) {
      response += delta + ' '; // Concatenate each token with a space
    }
  }
}

console.log(`Chatbot: ${response}`); // Print the complete response
res.json({ message: response});
  
  } catch (error) {
    console.error('Error sending message to OpenAI:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

 
// Route handler for sending messages to OpenAI
// Modify the existing route handler for '/api/upload-document'
const fs = require('fs');


const tempDir = path.join(__dirname, 'temp');

// Check if the temp directory exists, if not, create it
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Function to save the uploaded file temporarily
function saveTempFile(fileData, fileName) {
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, fileData);
  return filePath;
}

// Function to delete a temp file
function deleteTempFile(filePath) {
  fs.unlinkSync(filePath);
}

// Function to mask Aadhar number
function maskAadharNumber(aadharNumber) {
  // Mask all but the last 4 digits
  const maskedDigits = aadharNumber.slice(0, -4).replace(/\d/g, '*');
  const lastFourDigits = aadharNumber.slice(-4);
  return maskedDigits + lastFourDigits;
}


 
async function recognizeText(fileData) {
  try {
    console.log('Performing OCR on the uploaded document');
 
    let result = await computerVisionClient.readInStream(
      fileData,
      {
        contentType: 'application/pdf', // Adjust content type if needed
        rawResponse: true
      }
    );
 
    let operationLocation = result.operationLocation.split('/').slice(-1)[0];
 
    while (true) {
      result = await computerVisionClient.getReadResult(operationLocation);
 
      if (result.status === 'succeeded') {
        break;
      }
 
      await sleep(1000); // Sleep for 1 second
    }
 
    const extractedData = extractLimitedDataFromOCRResult(result.analyzeResult.readResults);
    return extractedData;
  } catch (error) {
    console.error('Error performing OCR:', error);
    throw error;
  }
}
 
const AadharRegex = /\b\d{4}\s\d{4}\s\d{4}\b/;
const PanCardRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/;
 
function extractLimitedDataFromOCRResult(ocrResult) {
  try {
    let extractedData = {
      name: "",
      dob: "",
      AadharNumber: "",
      panCardNumber: ""
    };
 
    let dobFound = false;
    let aadharFound = false;
    let panFound = false;
 
    for (const page in ocrResult) {
      const result = ocrResult[page];
      if (result.lines.length) {
        for (let i = 0; i < result.lines.length; i++) {
          const line = result.lines[i];
          const text = line.words.map(w => w.text).join(' ').trim();
 
          console.log('Processing line:', text); // Log the text being processed
 
          // Extracting name
          if (!extractedData.name && text.toLowerCase().includes("name:")) {
            // Look for "Name:" in the text
            const nameIndex = text.toLowerCase().indexOf("name:");
            if (nameIndex !== -1) {
              // If "Name:" is found, get the text from the next line
              if (i + 1 < result.lines.length) {
                extractedData.name = result.lines[i + 1].words.map(w => w.text).join(' ').trim();
                console.log('Name found:', extractedData.name);
              }
            }
          }
 
          // Extracting date of birth
          if (!dobFound && text.toLowerCase().includes("dob")) {
            console.log('DOB found:', text);
            extractedData.dob = text.split(":")[1].trim();
            dobFound = true;
          }
 
          // Extracting Aadhar number
          if (!aadharFound && (text.toLowerCase().includes("महिला / female") || text.toLowerCase().includes("पुरुष / male") || text.toLowerCase().includes("female"))) {
            const nextLineIndex = i + 1;
            if (nextLineIndex < result.lines.length) {
              const nextLineText = result.lines[nextLineIndex].words.map(w => w.text).join(' ').trim();
              console.log('Aadhar number found:', nextLineText);
              const aadharMatch = nextLineText.match(/\b\d{4}\s\d{4}\s\d{4}\b/);
              if (aadharMatch) {
                const trimmedAadharNumber = aadharMatch[0].replace(/\s/g, '');
                extractedData.AadharNumber = trimmedAadharNumber;
                aadharFound = true;
              }
            }
          }
 
          // Extracting PAN card number
          if (!panFound && PanCardRegex.test(text)) {
            console.log('PAN card number found:', text.match(PanCardRegex)[0]);
            extractedData.panCardNumber = text.match(PanCardRegex)[0];
            panFound = true;
          }
 
          // Break loop if all required data is found
          if (extractedData.name && dobFound && aadharFound && panFound) {
            break;
          }
        }
      }
    }
 
    console.log('Extracted data:', extractedData); // Log the extracted data
 
    return extractedData;
  } catch (error) {
    console.error('Error extracting limited data from OCR result:', error);
    throw error;
  }
}
 
// Function to check if a text is an Aadhar card number
function isAadharNumber(text) {
  // Check if text consists of exactly 12 digits
  return /^\d{12}$/.test(text);
}
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
 