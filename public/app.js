const $ = (id) => document.getElementById(id);

// Load .txt file into transcript textarea
$("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  $("transcript").value = text;
});

$("summarizeBtn").addEventListener("click", async () => {
  const transcript = $("transcript").value.trim();
  const instruction = $("instruction").value.trim();
  $("sumStatus").textContent = "Summarizing...";

  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, instruction })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Summarization failed');
    $("summary").value = data.summary || '';
    $("sumStatus").textContent = "Done";
  } catch (err) {
    $("sumStatus").textContent = `Error: ${err.message}`;
  }
});

$("sendBtn").addEventListener("click", async () => {
  const to = $("emails").value.trim();
  const subject = $("subject").value.trim() || 'Meeting Summary';
  const body = $("summary").value.trim();
  $("sendStatus").textContent = "Sending...";

  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Send failed');
    $("sendStatus").textContent = `Sent ✔ ${data.id ? '(id: ' + data.id + ')' : ''}`;
  } catch (err) {
    $("sendStatus").textContent = `Error: ${err.message}`;
  }
});
