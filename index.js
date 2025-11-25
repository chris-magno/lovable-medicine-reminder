import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cron from "node-cron";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory reminders
let reminders = [];

// Add a new reminder
app.post("/add-reminder", (req, res) => {
  const { patientName, medicine, dosage, notes, phoneNumber, datetime } = req.body;

  if (!patientName || !medicine || !dosage || !phoneNumber || !datetime) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  reminders.push({ patientName, medicine, dosage, notes, phoneNumber, datetime, sent: false });
  res.json({ success: true, reminders });
});

// Get reminders
app.get("/reminders", (req, res) => res.json({ reminders }));

// Send SMS via iProg
async function sendSMS(phoneNumber, message) {
  let formatted = phoneNumber.startsWith("0") ? "63" + phoneNumber.slice(1) : phoneNumber;
  if (formatted.startsWith("+")) formatted = formatted.slice(1);

  const payload = {
    api_token: process.env.IPROG_API_TOKEN,
    phone_number: formatted,
    message,
    sender_id: "MedicalAlert" // Custom sender name
  };

  const response = await fetch("https://www.iprogsms.com/api/v1/sms_messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log("SMS sent:", data);
}

// Scheduler: run every minute
cron.schedule("* * * * *", () => {
  const now = new Date();

  reminders.forEach(reminder => {
    if (!reminder.sent && new Date(reminder.datetime) <= now) {
      const msg = `Medical Alert for ${reminder.patientName}: Take ${reminder.medicine} (${reminder.dosage}). Notes: ${reminder.notes}`;
      sendSMS(reminder.phoneNumber, msg);
      reminder.sent = true;
    }
  });
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
