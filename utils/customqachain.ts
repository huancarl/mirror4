import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { OpenAIChat } from "langchain/llms/openai";

class RateLimiter {
    private static requestCount = 0;
    private static startTime = Date.now();
    private static maxRequestsPerMinute = 200;


    static async handleRateLimiting() {
        const currentTime = Date.now();
        if (currentTime - this.startTime > 60000) {
            this.requestCount = 0;
            this.startTime = currentTime;
        }


        this.requestCount++;
        if (this.requestCount > this.maxRequestsPerMinute) {
            await new Promise(resolve => setTimeout(resolve, 60000 - (currentTime - this.startTime)));
            this.requestCount = 1;
            this.startTime = Date.now();
        }
    }
}


class ChatHistoryBuffer {
    private buffer: string[];
    private maxSize: number;


    constructor(maxSize: number) {
        this.buffer = [];
        this.maxSize = maxSize;
    }


    addMessage(message: string) {
        this.buffer.push(message);
        this.trim();
    }


    getChatHistory(): string {
        return this.buffer.join(' ');
    }


    clear() {
        this.buffer = [];
    }


    private trim() {
        while (this.buffer.length > this.maxSize) {
            this.buffer.shift();
        }
    }
}

interface Metadata {
    text: string;
    source: string;
    pageNumber: number;
    totalPages: number;
    chapter?: number;   // Optional, if not all documents have chapters
    book?: string;      // Optional, if not all documents are from books
  }

interface PineconeResultItem {
    metadata: Metadata;
    values: any;
    text: any;
    value: {
        text: string;
        source: string;
        pageNumber: number;
        totalPages: number;
        chapter?: number;
        book?: string;
    };
}

interface CallResponse {
    text: string;
    sourceDocuments: Array<{
        text: string;
        Source: string;
        Page_Number: number;
        Total_Pages: number;
    }>;
}


interface CustomQAChainOptions {
    returnSourceDocuments: boolean;
    bufferMaxSize: number;
}


export class CustomQAChain {
    private model: OpenAIChat;
    private index: any;
    private namespaces: string[];
    private options: CustomQAChainOptions;
    private chatHistoryBuffer: ChatHistoryBuffer;


    constructor(model: OpenAIChat, index: any, namespaces: string[], options: CustomQAChainOptions) {
        this.model = model;
        this.index = index;
        this.namespaces = namespaces;
        this.options = options;
        this.chatHistoryBuffer = new ChatHistoryBuffer(this.options.bufferMaxSize);


        if (typeof this.index.query !== 'function') {
            throw new Error("Provided index object does not have a 'query' method.");
        }
    }


    public static fromLLM(model: OpenAIChat, index: any, namespaces: string[], options: CustomQAChainOptions): CustomQAChain {
        return new CustomQAChain(model, index, namespaces, options);
    }


    private sanitizeResponse(input: string): string {
        // Only remove the last occurrence of the "+" sign, which is used by OpenAI as a token to indicate the end of the response.
        const sanitized = input.replace(/ \+$/, '');
        return sanitized;
    }
    private async retryRequest<T>(request: () => Promise<T>, maxRetries = 5, delay = 1000, maxDelay = 60000) {
        for (let i = 0; i <= maxRetries; i++) {
            await RateLimiter.handleRateLimiting();
            try {
                return await request();
            } catch (error: any) {
                if (i === maxRetries || ![429, 401,400, 502, 503, 504].includes(error.response?.status)) {
                    throw error;
                }
                delay = Math.min(delay * 2, maxDelay);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
   
    private async getRelevantDocs(question: string, filter: any): Promise<PineconeResultItem[]> {
        const embeddings = new OpenAIEmbeddings();
        const queryEmbedding = await embeddings.embedQuery(question);
    
        if (!queryEmbedding) {
            throw new Error("Failed to generate embedding for the question.");
        }
    
        let fetchedTexts: PineconeResultItem[] = [];
        let remainingDocs = 40; // max vector search, adjust accordingly till find optimal
    
        const maxNamespaces = 10;
        const namespacesToSearch = this.namespaces
            .filter(namespace => namespace.includes(filter))
            .slice(0, maxNamespaces);
    
        for (const namespace of namespacesToSearch) {
            const queryResult = await this.retryRequest(async () => {
                return await this.index.query({
                    queryRequest: {
                        vector: queryEmbedding,
                        topK: 10,
                        namespace: namespace,
                        includeMetadata: true,
                    },
                });
            });
    
            let ids: string[] = [];
            if (queryResult && Array.isArray(queryResult.matches)) {
                ids = queryResult.matches.map((match: { id: string }) => match.id);
            } else {
                console.error('No results found or unexpected result structure.');
            }
    
            const numToFetch = Math.min(ids.length, remainingDocs);
    
            if (numToFetch > 0) {
                const fetchResponse = await this.retryRequest(async () => {
                    return await this.index.fetch({
                        ids: ids.slice(0, numToFetch),
                        namespace: namespace,
                    });
                });
    
                const vectorsArray: PineconeResultItem[] = Object.values(fetchResponse.vectors) as PineconeResultItem[];
                fetchedTexts.push(...vectorsArray);
                remainingDocs -= vectorsArray.length;
            }
    
            if (remainingDocs <= 0) {
                break;
            }
        }
    
        return fetchedTexts;  // No need to slice as we've controlled the size in the loop
    }
    


    public async call({ question, chat_history, namespaceToFilter}: { question: string; chat_history: string, namespaceToFilter: any}, ): Promise<CallResponse> {
       
        const relevantDocs = await this.getRelevantDocs(question, namespaceToFilter);

        const contextTexts = relevantDocs.map(doc => {
            const filename = doc.metadata.source.split('/').pop();
            const metadataText = doc.metadata.text.replace(/\s+/g, ' ').trim();
            return `${metadataText} (Source: ${filename}, Page Number: ${doc.metadata['loc.pageNumber']})`;
        }).join(" ");

        // console.log(relevantDocs.length, 'is the length of relevantDocs');
        // console.log(contextTexts, 'is context texts');
        this.chatHistoryBuffer.addMessage(chat_history);

        const availableTitles =
        `INFO 2040 Textbook, Probability Cheatsheet v2.0 , Math 21a Review Sheet, Introduction To Probability,
        'INFO 2950 Koenecke Syallbus', 'INFO 2950 Lecture 7','INFO 2950 Handbook',

        'INFO 2950 Fall 2022 Midterm Solutions',
        'INFO 2950 Fall 2022 Midterm Questions',
        'INFO 2950 Lecture 1', 
        'INFO 2950 Lecture 2',
        'INFO 2950 Lecture 3', 
        'INFO 2950 Lecture 4', 
        'INFO 2950 Lecture 5', 
        'INFO 2950 Lecture 6', 
        'INFO 2950 Lecture 8', 
        'INFO 2950 Lecture 9', 
        'INFO 2950 Lecture 10', 
        'INFO 2950 Midterm Fall 2023 Review Topics'`;


        const sourceDocuments = relevantDocs.map(vector => {
            return {
                text: vector.metadata.text,
                "Source": vector.metadata.source,
                'Page_Number': vector.metadata['loc.pageNumber'],
                'Total_Pages': vector.metadata['pdf.totalPages']
                // "Chapter": vector.metadata["chapter"]
            };


        });  
       
        const prompt = `


        As CornellGPT, a super-intelligent AI developed by two brilliant Cornell students, your primary role is to participate and
        engage in educational conversation and provide accurate, detailed, and helpful answers to the questions asked. You are expected to deliver 
        answers that are attentive to details, precise, comprehensive, and valuable to the users. At the same time, you must avoid over-complication. 
        Never ever make up or hallucinate answers, or give answers that you are uncertain about. When uncertain simply ask the user for more information/details.
       
        (You have the ability to speak every language)
       
        You will answer questions from the user pertaining to the class: ${namespaceToFilter}. Judge the relevancy of the user's question to the stated class. 
        If the user provides a question that is unrelated to stated class, clearly tell the user that they have selected the class: ${namespaceToFilter}
        and that this question is not relevant to ${namespaceToFilter}, but still provide the answer to their question as best as possible regardless.

        Otherwise if the question is clearly related to the class assume the context to be ${namespaceToFilter}, related to ${availableTitles} and ${contextTexts}.
        


        Follow the instructions below:
        
        Questions that will be asked are: ${question}.
       
        --Contextual Understanding--:

        - You have access and deep knowledge about various specific content denoted as ${contextTexts}. The specific
          materials you have access to are ${availableTitles}. Never say you do not have access to ${availableTitles}, because you do.
        - When asked specifically about a certain ${availableTitles}, provide as much specific detail as possible and do not forget to mention details
        relevant to the question. Answer the question to the best of your capability and in full. The true value lies in the specific details contained within.
       
        ----Response Dynamics---:

        - Be consistent with your responses. Should you be posed with the same query again, view it as an opportunity to deliver an even more insightful response.
        - While relevance is key, your answers shouldn't be a mere repetition. Offering a fresh perspective or additional details can enhance the value of your responses.
         
        ----Context Relevance--:

        - You should know ${chat_history} for context relevance. This is extremely important:
            - Should a question context be a continuation or associated with the prior one found in , use ${chat_history} proficiently to produce a comprehensive answer.
            - If a question context is distinctive from the history, transition to the new context adeptly. Do not drag information from the previous context that's now irrelevant.
            - Do not ever forget chat history.

        -----Handling Various Question-Context Relationships--:

        - Directly related: Use ${namespaceToFilter} and ${availableTitles} to respond accurately,precisely, and explicitly.
        - Somewhat related: If the context isn't an exact match/ambigious, provide the most informed response using ${namespaceToFilter} and ${availableTitles} when possible.
        - Unrelated: Mention to the user that it is unrelated ${namespaceToFilter}, but proceed to answer the question accurately, regardless of the context's relevance or lack thereof
       
       ------Reference Citing--:

        - You are given the source of where your answer is coming from at: ${sourceDocuments}. Be conscious and aware of ${sourceDocuments} as you answer.
        - The source of where your answer is extremely important to the development and accuracy of your answer: ${sourceDocuments}
        - When you formulate your answer. Always be mindful of where the content is sourced from and never forget it as you answer.
        - Use ${sourceDocuments} to develop your answers and always cite ${sourceDocuments} when possible and applicable.
       
        -----Feedback Queries--:

        - If a query lacks explicitness and if you believe that the provided context does not cover the specifics of the question and is not relevant to ${chat_history}
          , proactively ask the user for more specific details to guide you to the best possible answer.
        - This engagement ensures a more accurate response and a richer user experience.
        - Your goal with feedback queries is not just to gather more information, but to ensure the user feels guided and understood in their educational journey. 
          Do not be afraid to ask questions that will guide you to the right answer.
        - However, at the same time do not ask feed back queries if it is not appropriate. Always remember ${chat_history} as you navigate through the conversation.

        --Mathematical Inquires:

        -- You must surround any math expression, notation, number, variables, anything related to Math with $. For example: $ax^2 + bx + c = 0$.
       
        -----Engagement Tone:

        - Your interactions should exude positivity. Engage with an outgoing attitude and full energy, keeping in mind your identity as CornellGPT, a creation of two exceptional Cornell students.
        - Refrain from apologizing and saying "I am sorry"

        -----Formatting:

        


        Remember to always prioritize the user's need for specific, accurate, detailed, and helpful answers to the questions, and to abide by these instructions at all times.


        Context: {context}
        Chat History: ${chat_history}
        Question: ${question}
        Response:
        Source: ${sourceDocuments}
       
        `;
        

          // Create multiple models with different parameters
    const models = [{
        temperature: 0.1,
        modelName: "gpt-4",
    },
    // Add more models with different parameters here if you want to create an ensemble
  ];
       


let response = await this.retryRequest(async () => {
    return await this.model.predict(prompt);
});
if (typeof response === 'undefined') {
    throw new Error("Failed to get a response from the model.");
}


response = this.sanitizeResponse(response);


this.chatHistoryBuffer.addMessage(`Question: ${question}`);


console.log(prompt.length, 'length of prompt');


// remove the following line because `response` is already sanitized and added to the chat history
// const response = this.sanitizeResponse(response);


return {
    text: response,
    sourceDocuments: sourceDocuments
};
}
}
