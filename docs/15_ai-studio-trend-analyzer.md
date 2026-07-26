# 15_ AI Studio Trends Analyzer Documentation

This document outlines the technical architecture, data structures, backend api endpoints, and frontend user interface of the **Trends Analyzer** feature in the Postelligence AI Studio (`app/(shell)/ai-studio/`).

---

## 🚀 Overview

The **Trends Analyzer** is designed to help creators discover viral topics across various categories (Tech, Business, Marketing, Lifestyle, and Design) and automatically package them into ready-to-publish social media campaigns (complete with a tailored post caption and an AI-generated matching visual).

---

## 📡 Backend API Architecture

The Trends Analyzer relies on two main Next.js API routes: `/api/ai/generate` and `/api/ai/image-generate`.

### 1. Trends Forecasting API (`/api/ai/generate` with `mode: "trends-list"`)
When the Trends tab is loaded, the frontend dispatches a POST request with `mode: "trends-list"` to retrieve currently forecasting viral topics.
- **AI Prompt Structure**:
  Instructs the AI to act as a viral trend forecasting analyst. It prompts the generation of **5 current viral trends** across key categories:
  - Tech, Business, Marketing, Lifestyle, and Design.
- **Required JSON Schema Output**:
  ```json
  [
    {
      "title": "Short catchy trend title (under 5 words)",
      "explanation": "1-sentence description detailing what the trend is and why it is viral",
      "category": "Tech | Business | Marketing | Lifestyle | Design",
      "imagePrompt": "Detailed creative prompt to feed an AI image generator to represent the trend visual",
      "captionPrompt": "Specific guidelines telling the model how to write a viral copy package for this trend"
    }
  ]
  ```

### 2. Campaign Copy Generation API (`/api/ai/generate` with `mode: "trends-post"`)
When a user clicks on a trend, the system calls the generation endpoint with `mode: "trends-post"` and passes:
- `topic`: The selected trend's Title.
- `existingContent`: The trend's Explanation.
- **AI Copy Prompt**:
  Instructs the model to behave as a viral strategist and write a highly engaging social media post caption matching the trend's style, utilizing hook lines, value paragraphs, and relevant hashtags.

### 3. Image Generation API (`/api/ai/image-generate`)
In parallel with the text generation, the front-end calls `/api/ai/image-generate` passing:
- `prompt`: The trend's pre-defined `imagePrompt`.
This endpoint hooks into the AI image generation model (Gemini Imagen / Stable Diffusion) and returns a unique `publicUrl` of the generated artwork.

---

## 🎨 Frontend Client Architecture (`AIStudioClient.tsx`)

The frontend manages trends inside a dedicated layout tab (`activeTab === "trends"`):

### 1. State Management
- `trends`: Array of forecasted items.
- `trendsLoading` / `trendsError`: Fetching and boundary states.
- `selectedTrend`: The active trend card object.
- `trendGeneratedPost`: Object containing `{ caption, imageUrl }` when a trend campaign is packaged.
- `trendTextLoading` / `trendImageLoading`: Separate loaders for copy and image rendering.

### 2. Interactive User Experience (UX)
- **Left Column (Viral Trends List)**:
  Displays the 5 trending cards with colorful category labels. Clicking a trend sets `selectedTrend` and launches `generateTrendPost(trend)`.
- **Right Column (Campaign Generator & Preview)**:
  - **Loading Stage**: Displays a sleek loading animation showing progress indicators (*"Analyzing category hook templates..."*, *"Drawing visual representations..."*).
  - **Campaign Details Panel**: Displays the title and category, renders the AI-generated picture, and prints the copy caption in a rich textbox.
  - **Micro-Regeneration Actions**:
    - **Regenerate Caption**: Re-runs the `trends-post` API call without changing the image.
    - **Regenerate Image**: Re-runs the `image-generate` API call with the `imagePrompt` to draw a fresh layout.
  - **Quick Onboarding**: Clicking *"Use Campaign"* copies the copy details and redirects the user to the Compose composer page with the text and image loaded!