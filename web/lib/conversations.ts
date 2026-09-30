export interface ConversationMessage {
  id: string;
  sender: "customer" | "sales";
  text: string;
}

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function conversationMessages(text: string): ConversationMessage[] {
  return text.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    const match = line.match(/^\s*(Cliente|Ventas):\s?(.*)$/);
    return [{
      id: String(index),
      sender: match?.[1] === "Ventas" ? "sales" as const : "customer" as const,
      text: match ? match[2] : line,
    }];
  });
}
