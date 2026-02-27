import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { personas, PersonaId } from "@/lib/personas";

interface PanelResponseProps {
    responses: {
        personaId: PersonaId;
        status: "success" | "error";
        content: string;
    }[];
}

export function PanelResponse({ responses }: PanelResponseProps) {
    if (!responses || responses.length === 0) return null;

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center space-x-2 px-2">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Buffett's Analysis</h3>
                <div className="h-px bg-neutral-800 flex-1" />
            </div>

            <div className="grid grid-cols-1 gap-6">
                {responses.map((response, index) => {
                    const persona = personas[response.personaId];
                    if (!persona) return null;

                    return (
                        <div
                            key={response.personaId}
                            className="glass-panel p-4 md:p-6 flex flex-col space-y-3 md:space-y-4 hover:border-teal-900/50 transition-colors"
                            style={{ animationDelay: `${index * 150}ms` }}
                        >
                            <div className="flex items-center space-x-3 border-b border-neutral-800/50 pb-3 md:pb-4">
                                <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-neutral-800 flex items-center justify-center text-lg md:text-xl shadow-inner flex-shrink-0">
                                    {persona.avatar}
                                </div>
                                <div>
                                    <h4 className="text-base md:text-lg font-medium text-neutral-200">{persona.name}</h4>
                                    <p className="text-[10px] md:text-xs text-teal-500 font-medium">{persona.tagline}</p>
                                </div>
                            </div>

                            <div className="prose prose-invert prose-p:text-neutral-300 prose-a:text-teal-400 prose-strong:text-neutral-100 prose-headings:text-neutral-200 prose-sm md:prose-base max-w-none custom-scrollbar overflow-x-auto overflow-y-auto max-h-[60vh] md:max-h-[400px] pr-2">
                                {response.status === "error" ? (
                                    <p className="text-red-400 italic">{response.content}</p>
                                ) : (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {response.content}
                                    </ReactMarkdown>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div >
    );
}
