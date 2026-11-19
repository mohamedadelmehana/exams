/* NUSC Exam Generator - Vanilla JavaScript prototype */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let questions = [], generated = null, currentTitle = "NUSC Exam", sourceFile = "";
const STORAGE_KEY = "nusc_exam_history_v1";
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function go(view){$$(".view").forEach(v=>v.classList.remove("active"));$("#"+view+"View").classList.add("active");$$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===view));$("#pageTitle").textContent=({dashboard:"Dashboard",create:"Create exam",history:"Exam history",results:"Generated models"})[view];$("#sidebar").classList.remove("open");if(view==="history")renderHistory();if(view==="dashboard")renderDashboard();window.scrollTo(0,0)}
$$("[data-view]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.view)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
$("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#manualToggle").addEventListener("click",()=>$("#manualPanel").classList.toggle("hidden"));
$("#downloadSample").addEventListener("click",()=>downloadBlob(sampleText(),"nusc-exam-sample.txt","text/plain"));
function sampleText(){return `Q1. What does HTML stand for?\nA) Hyper Text Markup Language\nB) High Text Machine Language\nC) Home Tool Markup Language\nD) Hyperlinks Text Management Language\nAnswer: A\n\nQ2. CSS is mainly used for?\nA) Styling web pages\nB) Managing databases\nC) Writing server hardware\nD) Compiling Java\nAnswer: A\n\nQ3. Which one is a JavaScript data type?\nA) Boolean\nB) Paragraph\nC) StyleSheet\nD) BrowserWindow\nAnswer: A\n\nQ4. Which tag creates a hyperlink in HTML?\nA) <p>\nB) <a>\nC) <img>\nD) <div>\nAnswer: B`;}
$("#examFile").addEventListener("change",e=>{if(e.target.files[0])handleFile(e.target.files[0])});
const dz=$("#dropZone");dz.addEventListener("dragover",e=>{e.preventDefault();dz.classList.add("drag")});dz.addEventListener("dragleave",()=>dz.classList.remove("drag"));dz.addEventListener("drop",e=>{e.preventDefault();dz.classList.remove("drag");const f=e.dataTransfer.files[0];if(f)handleFile(f)});
async function handleFile(file){
  sourceFile=file.name;
  $("#fileFeedback").textContent="Reading "+file.name+"…";
  try{
    let text="";
    const ext=file.name.split(".").pop().toLowerCase();
    if(ext==="txt"){
      text=await file.text();
    }else if(ext==="docx"){
      if(!window.mammoth)throw Error("DOCX library did not load. Check your internet connection.");
      const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
      text=result.value;
    }else if(ext==="pdf"){
      if(!window.pdfjsLib)throw Error("PDF library did not load. Check your internet connection.");
      const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
      const pageTexts=[];
      for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
        const page=await pdf.getPage(pageNo);
        const content=await page.getTextContent();
        // PDF.js marks the end of visual lines with hasEOL. Preserve those
        // boundaries rather than flattening the entire page into one line.
        let pageText="";
        for(const item of content.items){
          if(!item.str)continue;
          pageText+=item.str;
          pageText+=item.hasEOL?"\n":" ";
        }
        pageTexts.push(pageText);
      }
      text=pageTexts.join("\n");
    }else{
      throw Error("Please upload PDF, DOCX or TXT.");
    }
    $("#manualText").value=text;
    const parsed=parseQuestions(text);
    if(!parsed.length){
      $("#fileFeedback").textContent="The file was read, but the question format was not recognized. Open the extracted text below, or use the supported format example.";
      $("#manualPanel").classList.remove("hidden");
      $("#manualText").focus();
      return;
    }
    questions=parsed;
    $("#fileFeedback").textContent=`✓ ${file.name} loaded — ${questions.length} questions detected.`;
    showReview();
  }catch(err){
    $("#fileFeedback").textContent="Could not read file: "+err.message;
    toast(err.message);
  }
}
$("#parseManual").addEventListener("click",()=>{
  questions=parseQuestions($("#manualText").value);
  if(!questions.length){toast("No questions found. Check that questions start with Q1., Q2., etc.");return;}
  $("#fileFeedback").textContent=`✓ ${questions.length} questions parsed.`;
  showReview();
});
function parseQuestions(raw){
  // Normalize common PDF/Word whitespace and recover markers that some PDF
  // extractors place on the same line.
  let normalized=String(raw||"")
    .replace(/\u00a0/g," ")
    .replace(/[\u200b\ufeff]/g,"")
    .replace(/\r/g,"\n")
    .replace(/[ \t]+/g," ");
  normalized=normalized
    .replace(/([^\n])\s+(?=(?:Q(?:uestion)?\s*)\d+\s*[.):\-])/gi,"$1\n")
    .replace(/([^\n])\s+(?=(?:Answer|Ans|Correct(?:\s+answer)?)\s*[:=\-])/gi,"$1\n");

  const lines=normalized.split("\n").map(line=>line.trim()).filter(Boolean);
  const starts=[];
  for(let i=0;i<lines.length;i++){
    if(/^(?:Q(?:uestion)?\s*)\d+\s*[.):\-]/i.test(lines[i]))starts.push(i);
  }
  if(!starts.length)return [];

  const result=[];
  for(let n=0;n<starts.length;n++){
    const block=lines.slice(starts[n],starts[n+1]??lines.length);
    const first=block[0].match(/^(?:Q(?:uestion)?\s*)\d+\s*[.):\-]\s*(.*)$/i);
    if(!first)continue;
    let prompt=first[1].trim();
    const options=[];
    let correctId=null;
    for(const line of block.slice(1)){
      const answerMatch=line.match(/^(?:Answer|Ans|Correct(?:\s+answer)?)\s*[:=\-]\s*([A-H])\b/i);
      if(answerMatch){correctId=answerMatch[1].toLowerCase();continue;}
      const optionMatch=line.match(/^([A-H])\s*[).:\-]\s*(.+)$/i);
      if(optionMatch){options.push({id:optionMatch[1].toLowerCase(),text:optionMatch[2].trim()});continue;}
      if(options.length){options[options.length-1].text+=(options[options.length-1].text?" ":"")+line;}
      else{prompt+=(prompt?" ":"")+line;}
    }
    if(prompt){
      result.push({
        id:(globalThis.crypto?.randomUUID?.()||`q-${Date.now()}-${n}`),
        type:options.length?"mcq":"written",
        prompt,
        options,
        correctId
      });
    }
  }
  return result;
}
function showReview(){if(!questions.length)return;$("#reviewCard").classList.remove("hidden");$("#questionCount").textContent=questions.length+" questions";renderQuestionEditor();$("#reviewCard").scrollIntoView({behavior:"smooth",block:"start"});}
function renderQuestionEditor(){const host=$("#questionEditor");host.innerHTML="";questions.forEach((q,i)=>{const card=document.createElement("div");card.className="question-row";card.innerHTML=`<div class="question-top"><span class="question-number">QUESTION ${i+1} · ${q.type==="mcq"?"MULTIPLE CHOICE":"WRITTEN"}</span><button class="remove-question" data-remove="${i}">Remove</button></div><textarea class="question-input prompt-input" rows="2" placeholder="Enter question">${escapeHtml(q.prompt)}</textarea><div class="options-grid"></div><div class="answer-label">${q.options.length?"Select the correct answer:":"Written question — no answer choice shuffle."}</div>`;const grid=card.querySelector(".options-grid");q.options.forEach((o,j)=>{const label=document.createElement("label");label.className="option-field";label.innerHTML=`<input type="radio" name="correct-${i}" ${q.correctId===o.id?"checked":""}><span>${String.fromCharCode(65+j)}.</span><input type="text" value="${escapeAttr(o.text)}">`;grid.appendChild(label);});card.querySelector(".prompt-input").addEventListener("input",e=>q.prompt=e.target.value);[...grid.querySelectorAll("label")].forEach((label,j)=>{label.querySelector('input[type="text"]').addEventListener("input",e=>q.options[j].text=e.target.value);label.querySelector('input[type="radio"]').addEventListener("change",()=>q.correctId=q.options[j].id);});card.querySelector("[data-remove]").addEventListener("click",()=>{questions.splice(i,1);renderQuestionEditor();$("#questionCount").textContent=questions.length+" questions";});host.appendChild(card);});}
$("#addQuestion").addEventListener("click",()=>{questions.push({id:"q"+Date.now(),type:"mcq",prompt:"New question",options:[{id:"a",text:"Option A"},{id:"b",text:"Option B"},{id:"c",text:"Option C"},{id:"d",text:"Option D"}],correctId:"a"});renderQuestionEditor();$("#questionCount").textContent=questions.length+" questions";});
$("#generateBtn").addEventListener("click",()=>{if(!questions.length){toast("Add at least one question first.");return;}const missing=questions.findIndex(q=>!q.prompt.trim()||(q.options.length&&(!q.correctId||!q.options.every(o=>o.text.trim()))));if(missing>=0){toast(`Complete question ${missing+1} and select its correct answer.`);return;}currentTitle=sourceFile.replace(/\.[^.]+$/,"")||"NUSC Exam";generated=makeModels(questions);renderResults();go("results");});
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function makeModels(qs){const models={};["A","B","C","D"].forEach((letter,index)=>{let order=shuffle(qs);if(index>0&&qs.length>1){let attempts=0;while(order.map(q=>q.id).join("|")===models.A.map(q=>q.id).join("|")&&attempts++<10)order=shuffle(qs);}models[letter]=order.map(q=>{const clone=JSON.parse(JSON.stringify(q));if(clone.options.length){clone.options=shuffle(clone.options);clone.correctLetter=String.fromCharCode(65+clone.options.findIndex(o=>o.id===clone.correctId));}return clone;});});return models;}
function renderResults(){const total=questions.length;$("#resultExamTitle").textContent=currentTitle;$("#resultMeta").textContent=`4 models · ${total} questions per model`;const grid=$("#modelGrid");grid.innerHTML="";Object.entries(generated).forEach(([letter,qs])=>{const c=document.createElement("article");c.className="model-card";c.innerHTML=`<div class="model-head"><div class="model-letter">${letter}</div><span class="count-pill">${qs.length} Qs</span></div><h4>Model ${letter}</h4><p>Randomized question and option order</p><button class="btn btn-outline" data-model="${letter}">Download Word ↓</button><button class="btn btn-outline" data-pdf="${letter}">Print / Save PDF</button>`;grid.appendChild(c);});$$("[data-model]").forEach(b=>b.addEventListener("click",()=>exportDocx(b.dataset.model)));$$("[data-pdf]").forEach(b=>b.addEventListener("click",()=>printExam(b.dataset.pdf,false)));const keys=$("#answerKeys");let html='<div style="overflow-x:auto"><table class="key-table"><thead><tr><th>Question</th><th>Model A</th><th>Model B</th><th>Model C</th><th>Model D</th></tr></thead><tbody>';for(let i=0;i<total;i++){html+=`<tr><td>Q${i+1}</td>`;for(const m of Object.values(generated)){const q=m[i];html+=`<td class="correct-cell">${q.correctLetter||"—"}</td>`;}html+="</tr>";}keys.innerHTML=html+"</tbody></table></div>";}
function printExam(letter,answers){const qs=generated[letter];const title=`${currentTitle} — Model ${letter}`;let body=`<h1>${escapeHtml(title)}</h1><p>Name: ____________________ &nbsp; ID: ____________________ &nbsp; Date: __________</p><hr>`;qs.forEach((q,i)=>{body+=`<section><b>Q${i+1}. ${escapeHtml(q.prompt)}</b>`;if(q.options.length)body+="<ol type='A'>"+q.options.map(o=>`<li>${escapeHtml(o.text)}</li>`).join("")+"</ol>";body+="</section>";});if(answers){body+="<h2>Answer Key</h2><p>"+qs.map((q,i)=>`Q${i+1}: ${q.correctLetter||"Written"}`).join(" &nbsp; | &nbsp;")+"</p>";}const w=window.open("","_blank");if(!w){toast("Allow pop-ups to print or save as PDF.");return;}w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;padding:35px;color:#111;line-height:1.5}h1{text-align:center;font-size:20px}section{margin:18px 0;break-inside:avoid}li{margin:5px 0}@media print{body{padding:15mm}}</style></head><body>${body}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();}
async function exportDocx(letter){if(!window.docx){toast("DOCX library unavailable. Check internet connection.");return;}const {Document,Packer,Paragraph,TextRun,HeadingLevel}=docx;const qs=generated[letter];const children=[new Paragraph({text:`${currentTitle} — Model ${letter}`,heading:HeadingLevel.HEADING_1}),new Paragraph("Name: ____________________    ID: ____________________    Date: __________"),new Paragraph("")];qs.forEach((q,i)=>{children.push(new Paragraph({children:[new TextRun({text:`Q${i+1}. ${q.prompt}`,bold:true})]}));q.options.forEach((o,j)=>children.push(new Paragraph({text:`${String.fromCharCode(65+j)}) ${o.text}`,indent:{left:360}})));children.push(new Paragraph(""));});const doc=new Document({sections:[{children}]});const blob=await Packer.toBlob(doc);downloadBlob(blob,`${safeName(currentTitle)}-Model-${letter}.docx`);toast(`Model ${letter} downloaded.`);}
function downloadKeyDocx(letter){const qs=generated[letter];const {Document,Packer,Paragraph,HeadingLevel}=docx;const children=[new Paragraph({text:`${currentTitle} — Answer Key ${letter}`,heading:HeadingLevel.HEADING_1}),...qs.map((q,i)=>new Paragraph({text:`Q${i+1}: ${q.correctLetter||"Written answer"}`}))];const doc=new Document({sections:[{children}]});Packer.toBlob(doc).then(blob=>downloadBlob(blob,`${safeName(currentTitle)}-Answer-Key-${letter}.docx`));}
$("#downloadAll").addEventListener("click",async()=>{for(const l of ["A","B","C","D"]){await exportDocx(l);await downloadKeyDocx(l);}toast("Exam models and answer keys downloaded.");});
$("#saveExam").addEventListener("click",()=>{const history=getHistory();history.unshift({id:Date.now(),title:currentTitle,date:new Date().toISOString(),count:questions.length,models:generated});localStorage.setItem(STORAGE_KEY,JSON.stringify(history.slice(0,40)));toast("Exam saved in this browser.");renderDashboard();});
function getHistory(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}catch{return[]}}
function renderDashboard(){const h=getHistory();$("#statExams").textContent=h.length;$("#statModels").textContent=h.length*4;$("#statQuestions").textContent=h.reduce((s,x)=>s+x.count,0);renderExamItems($("#recentList"),h.slice(0,3));}
function renderHistory(){renderExamItems($("#historyList"),getHistory());}
function renderExamItems(host,items){if(!items.length){host.innerHTML='<div class="empty-state"><div class="empty-icon">▤</div><b>No saved exams</b><p>Save a generated exam to see it here.</p></div>';return;}host.innerHTML="";items.forEach(item=>{const row=document.createElement("div");row.className="exam-item";row.innerHTML=`<div class="exam-file-icon">▤</div><div class="exam-item-info"><b>${escapeHtml(item.title)}</b><small>${new Date(item.date).toLocaleDateString()} · ${item.count} questions · 4 models</small></div><div class="exam-item-actions"><button data-open="${item.id}">Open</button><button data-delete="${item.id}">Delete</button></div>`;host.appendChild(row);});host.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>{const item=getHistory().find(x=>x.id==b.dataset.open);if(item){generated=item.models;currentTitle=item.title;questions=Object.values(generated)[0];renderResults();go("results");}}));host.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(getHistory().filter(x=>x.id!=b.dataset.delete)));renderHistory();renderDashboard();toast("Exam deleted.");}));}
function downloadBlob(blob,name,type){const b=blob instanceof Blob?blob:new Blob([blob],{type});const url=URL.createObjectURL(b);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function safeName(s){return s.replace(/[^\w\-]+/g,"-").replace(/-+/g,"-").slice(0,50)||"NUSC-Exam"}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function escapeAttr(s){return escapeHtml(s).replace(/"/g,"&quot;")}
renderDashboard();