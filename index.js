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
const port = process.env.PORT || 3000;

// Middleware
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

// Get all reminders
app.get("/reminders", (req, res) => res.json({ reminders }));

// Send SMS via iProg with default sender, including "Medical Alert System" in the message
async function sendSMS(phoneNumber, message) {
  // Convert to international format
  let formatted = phoneNumber.startsWith("0") ? "63" + phoneNumber.slice(1) : phoneNumber;
  if (formatted.startsWith("+")) formatted = formatted.slice(1);

  // Prepend "Medical Alert System" to the message
  const fullMessage = `📢 Medical Alert System\n${message}`;

  const payload = {
    api_token: process.env.IPROG_API_TOKEN,
    phone_number: formatted,
    message: fullMessage
    // No sender_id, uses default iProg number
  };

  try {
    const response = await fetch("https://www.iprogsms.com/api/v1/sms_messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("SMS sent:", data);
  } catch (err) {
    console.error("Error sending SMS:", err);
  }
}

// Scheduler: check every minute for reminders
cron.schedule("* * * * *", async () => {
  const now = new Date();
  console.log("Checking reminders at", now.toLocaleString());

  for (const reminder of reminders) {
    if (!reminder.sent && new Date(reminder.datetime) <= now) {
      const msg = `
Patient: ${reminder.patientName}
Medicine: ${reminder.medicine}
Dosage: ${reminder.dosage}
Notes: ${reminder.notes}
Scheduled Time: ${new Date(reminder.datetime).toLocaleString()}
      `;
      await sendSMS(reminder.phoneNumber, msg);
      reminder.sent = true;
    }
  }
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
