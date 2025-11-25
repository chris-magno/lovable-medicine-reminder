import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// store reminders in memory
let reminders = [];

// ➤ Add a new reminder
app.post("/add-reminder", (req, res) => {
  const { patientName, medicine, dosage, notes, phoneNumber, datetime } = req.body;

  if (!patientName || !medicine || !dosage || !phoneNumber || !datetime) {
    return res.json({ success: false, error: "Missing fields" });
  }

  reminders.push({
    patientName,
    medicine,
    dosage,
    notes,
    phoneNumber,
    datetime,
    sent: false
  });

  return res.json({ success: true, reminders });
});

// ➤ Get all reminders
app.get("/reminders", (req, res) => {
  res.json({ reminders });
});

// ➤ SMS sender for iProgSMS
async function sendSMS(to, message) {
  let formatted = to.replace(/\D/g, ""); // remove any characters

  if (formatted.startsWith("0")) {
    formatted = "63" + formatted.slice(1);
  }

  const payload = {
    api_token: process.env.IPROG_API_TOKEN,
    phone_number: formatted,
    message,
    sender_id: "MEDICAL ALERT"
  };

  const response = await fetch("https://www.iprogsms.com/api/v1/sms_messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log("SMS API RESPONSE:", data);

  return data;
}

// ➤ This route must be pinged every 1 minute by cron-job.org
app.get("/send-due-reminders", async (req, res) => {
  const now = new Date();
  console.log("CHECKING REMINDERS at", now.toISOString());

  let sentCount = 0;

  for (let r of reminders) {
    if (!r.sent && new Date(r.datetime) <= now) {
      const msg =
        `📌 MEDICAL ALERT\n` +
        `Patient: ${r.patientName}\n` +
        `Medicine: ${r.medicine}\n` +
        `Dosage: ${r.dosage}\n` +
        `Notes: ${r.notes || "None"}\n` +
        `Scheduled: ${r.datetime}`;

      await sendSMS(r.phoneNumber, msg);

      r.sent = true;
      sentCount++;
    }
  }

  res.json({
    success: true,
    message: `Checked reminders. ${sentCount} SMS sent.`,
    reminders
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
