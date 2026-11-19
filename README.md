# NUSC Exam Generator (HTML/CSS/Vanilla JS)

## Run
1. Extract the ZIP.
2. Open `index.html` in a modern browser. For best results, run a local static server (e.g. VS Code Live Server).
3. Internet is required to load PDF.js, Mammoth.js and docx.js from CDNs.

## Supported import format
The parser recognizes question blocks beginning with `Q1.`, options such as `A)`, `B)`, and answer lines such as `Answer: B`.
PDF and DOCX imports are text extraction only. PDF line breaks are preserved using PDF.js line markers, and the question parser tolerates common extraction whitespace differences. Scanned PDFs, complicated tables, images and mathematical layouts may need manual correction. Review every question and answer before generating.

## Features
- Upload PDF, DOCX or TXT
- Manual question editing and question creation
- Generate four shuffled models A-D
- Shuffle MCQ choices while preserving correct option IDs
- Separate answer keys
- Export exam models as DOCX
- Print exam models or save as PDF from the browser print dialog
- Save exam history locally in the current browser

## Important security limitation
This is a front-end prototype. It does **not** implement the shared teacher password, server-side authentication, or central database. Do not publish it as a protected teachers-only site or upload confidential exams yet. A password embedded in client-side JavaScript can be inspected and bypassed. For real deployment, add Supabase Auth (or a backend) with server-enforced access policies and private file storage.

## Suggested next step
Connect Supabase for secure shared access and centralized exam history, then add a teacher login screen backed by server-side authentication.


## University logo
The supplied NUSC logo is stored at `assets/images/nusc-logo.jpg` and displayed in the sidebar brand area.


## PDF import parser update
The current build preserves PDF.js line endings (`hasEOL`) and normalizes common PDF whitespace before detecting numbered questions, choices, and answer lines. The supplied NUSC sample PDF was checked against the parser and produces five questions with four options and the expected answer IDs.


## Improved exam paper layout
- Branded NUSC examination header with the university logo and gold accent.
- Clear exam information, student details, and instruction area.
- Numbered question cards with readable two-column multiple-choice options.
- Separate printable teacher answer key for each model.
- Parser now recognizes options placed on the same line as a question (common with PDF text extraction).
- Word exports use improved headings, spacing, and answer-key formatting.
