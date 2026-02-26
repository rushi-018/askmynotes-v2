import os
import traceback
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from supabase.client import create_client

router = APIRouter(prefix="/api/chat", tags=["Chatbot"])

# Initialize Clients
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", output_dimensionality=3072)
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

# Memory Store
chat_sessions = {}

class ChatRequest(BaseModel):
    message: str
    session_id: str

async def get_summary(history):
    """Helper to condense old conversation into a short paragraph."""
    if len(history) < 6: return ""
    summary_prompt = f"Summarize the following conversation history in 2 sentences: {history[:-4]}"
    summary = await llm.ainvoke(summary_prompt)
    return summary.content

@router.post("/query")
async def chat_with_bot(request: ChatRequest):
    try:
        sid = request.session_id
        if sid not in chat_sessions:
            chat_sessions[sid] = []

        # 1. Generate Summary of older messages
        history_summary = await get_summary(chat_sessions[sid])

        # 2. Vector Search (RAG)
        query_vector = embeddings.embed_query(request.message)
        rpc_response = supabase.rpc("match_documents", {
            "query_embedding": query_vector,
            "match_threshold": 0.4,
            "match_count": 2
        }).execute()
        context = "\n".join([doc["content"] for doc in rpc_response.data]) if rpc_response.data else ""

        # 3. Final System Prompt with Weighted Importance
        system_prompt = f"""
        You are a smart assistant. 
        PREVIOUS CONVERSATION SUMMARY: {history_summary}
        
        CURRENT CONTEXT FROM DATABASE: 
        {context}
        
        INSTRUCTIONS:
        1. Prioritize the 'CURRENT CONTEXT' for facts.
        2. Use the 'SUMMARY' to understand the user's intent from earlier.
        3. If the answer is not in the context, use your knowledge but stay on topic.
        """

        # 4. Messages = System + Last 4 raw messages + Current Question
        messages = [("system", system_prompt)]
        messages.extend(chat_sessions[sid][-4:]) 
        messages.append(("user", request.message))

        # 5. Generate Response
        ai_response = await llm.ainvoke(messages)

        # 6. Update History
        chat_sessions[sid].append(("user", request.message))
        chat_sessions[sid].append(("assistant", ai_response.content))

        return {
            "answer": ai_response.content,
            "sources": list(set([d.get("metadata", {}).get("source") for d in rpc_response.data])) if rpc_response.data else []
        }

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))