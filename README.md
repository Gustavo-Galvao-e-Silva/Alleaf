# 🌿 Alleaf

> **Detect. Calm. Heal.** — Real-time stress detection and AI-powered relief, right on your wrist.

---

## 💡 What is Alleaf?

Alleaf is a wellness app that listens to your body so your mind doesn't have to fight alone.

Using wearable sensors that monitor **heart rate and galvanic skin response (GSR)**, Alleaf detects when your stress levels spike — and responds instantly. It triggers **haptic bilateral stimulation** (alternating vibrations inspired by EMDR therapy) to ground you in the moment, while an **AI therapy agent** guides you through personalized mindfulness exercises tailored to what your body is telling it.

No waiting rooms. No scheduling. Just calm, on demand.

---

## ✨ Features

- **🔬 Real-Time Stress Detection** — Continuous monitoring of heart rate and GSR signals via wearable sensors, processed through a trained scikit-learn classification model.
- **📳 Haptic Bilateral Stimulation** — Alternating vibration patterns delivered to calm the nervous system, grounded in the neuroscience behind EMDR therapy.
- **🤖 AI Therapy Agent** — A LangChain-powered conversational agent that conducts supportive check-ins and adapts its approach to your current stress profile.
- **🧘 Agentic Mindfulness Exercises** — Dynamic, context-aware exercises that evolve based on your biometric state — not a one-size-fits-all playlist.
- **📊 Stress Trend Insights** — Pandas-powered analytics that surface patterns in your stress over time so you can understand your triggers.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React / Next.js |
| Backend | Python / Flask |
| ML & Signal Processing | scikit-learn, Pandas |
| AI Agent | LangChain |
| Sensors | Wearable heart rate + GSR |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Python ≥ 3.10
- A compatible wearable device

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/alleaf.git
cd alleaf

# Install frontend dependencies
cd client
npm install

# Install backend dependencies
cd ../server
pip install -r requirements.txt
```

### Running Locally

```bash
# Start the Flask backend
cd server
flask run

# Start the Next.js frontend (in a separate terminal)
cd client
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) and pair your wearable to begin.

---

## 🧠 How It Works

```
Wearable Sensors (HR + GSR)
        │
        ▼
 Stress Classification (scikit-learn)
        │
   ┌────┴────┐
   ▼         ▼
Haptic    LangChain AI Agent
Bilateral  → Mindfulness Exercise
Stimulation  → Therapeutic Check-in
```

When elevated stress is detected, Alleaf triggers bilateral haptic feedback immediately while simultaneously prompting the AI agent to initiate a calming session. The agent adapts its tone and exercises based on the severity of the detected stress signal.

---

## 🌱 Why Alleaf?

Mental health support is still largely reactive — you seek help after a crisis. Alleaf flips that model. By sitting quietly in the background and responding the moment your body shows signs of distress, it brings proactive, evidence-based care into everyday life.

Bilateral stimulation has strong roots in clinical therapy (EMDR). We're making it accessible, automatic, and personal.

---

## 🏆 Built At

This project was built during **[Hackalytics]** in **[2026]**.

---

## 👥 Team

| Name | Role |
|---|---|
| Deep | Frontend |
| Gustavo | ML |
| Jhoon | Hardware |
| Kalyan | Backend |
