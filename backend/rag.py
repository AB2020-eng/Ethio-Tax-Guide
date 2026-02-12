from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple
import os
import re

from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np


EMBEDDING_MODEL_NAME = os.getenv(
    "RAG_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)


@dataclass
class DocumentChunk:
  text: str
  source: str
  article: str | None = None


class RagIndex:
  """
  Minimal in-memory FAISS index over Ethiopian tax PDFs.
  This keeps things simple for a prototype. Persist to disk if needed.
  """

  def __init__(self) -> None:
    self.model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    self.chunks: List[DocumentChunk] = []
    self.index: faiss.IndexFlatIP | None = None

  def _build_index(self) -> None:
    if not self.chunks:
      self.index = None
      return
    texts = [c.text for c in self.chunks]
    embeddings = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    dim = embeddings.shape[1]
    self.index = faiss.IndexFlatIP(dim)
    self.index.add(embeddings.astype("float32"))

  def _extract_article(self, text: str) -> str | None:
    # Very simple heuristic: look for "Article 5" or "Art. 5"
    m = re.search(r"(Article|Art\.)\s+(\d+[A-Za-z]?)", text, flags=re.IGNORECASE)
    if m:
      return f"Article {m.group(2)}"
    return None

  def add_pdf(self, path: str) -> None:
    reader = PdfReader(path)
    basename = os.path.basename(path)
    for page in reader.pages:
      raw_text = page.extract_text() or ""
      text = " ".join(raw_text.split())
      if not text:
        continue
      article = self._extract_article(text)
      self.chunks.append(
        DocumentChunk(
          text=text,
          source=basename,
          article=article,
        )
      )
    self._build_index()

  def search(self, query: str, k: int = 4) -> List[Tuple[DocumentChunk, float]]:
    if not self.index or not self.chunks:
      return []
    q_emb = self.model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
    scores, idxs = self.index.search(q_emb.astype("float32"), k)
    results: List[Tuple[DocumentChunk, float]] = []
    for score, idx in zip(scores[0], idxs[0]):
      if idx < 0 or idx >= len(self.chunks):
        continue
      results.append((self.chunks[idx], float(score)))
    return results


rag_index = RagIndex()


def index_pdf(path: str) -> None:
  rag_index.add_pdf(path)


def answer_question(question: str) -> Tuple[str, List[str]]:
  """
  Answer strictly from PDF text and always cite Proclamation Articles
  when they are present in the chunks.
  """
  results = rag_index.search(question, k=5)
  if not results:
    return (
      "I could not find an answer in the uploaded Ethiopian tax proclamations.",
      [],
    )

  context_parts = []
  sources: List[str] = []
  articles: List[str] = []

  for chunk, score in results:
    context_parts.append(chunk.text)
    source_label = chunk.source
    if chunk.article:
      source_label = f"{chunk.source} - {chunk.article}"
      articles.append(chunk.article)
    sources.append(source_label)

  # Very small, transparent answer generator: we just stitch context and
  # highlight Articles instead of hallucinating new law.
  unique_articles = sorted(set(articles))
  article_part = ""
  if unique_articles:
    article_part = (
      " Relevant Proclamation " +
      ("Articles " if len(unique_articles) > 1 else "Article ") +
      ", ".join(unique_articles) +
      " are referenced."
    )

  answer = (
    "Based on the uploaded Ethiopian tax proclamations, the most relevant excerpts are:\n\n"
    + "\n\n---\n\n".join(context_parts[:3])
    + "\n\n"
    + article_part
  ).strip()

  return answer, sources

