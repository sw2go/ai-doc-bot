import { useRef, useState, useEffect, useMemo } from 'react';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import Image from 'next/image';
import userIcon from 'public/usericon.png';
import botIcon from 'public/bot-image.png'
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { Document } from 'langchain/document';
import { NEXT_PUBLIC_PROVIDER_URL, NEXT_PUBLIC_PROVIDER_NAME, API_URL } from '@/config/buildtimeSettings';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ContextInfo, Chat } from '@/types/api';
import useLocalStorage from '@/utils/useLocalStorage';

export default function ChatPage() {
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sourceDocs, setSourceDocs] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uiContext, setUiContext] = useState<ContextInfo[]>([]);
  
  const [abortController, setAbortController] = useState<AbortController>();
  const [currentContext, setCurrentContext] = useLocalStorage('currentContext', '');
  const [session, setSession] = useLocalStorage('session', '');

  const [messageState, setMessageState] = useState<{
    messages: Message[];
    pending?: string;
    history: [string, string][];
    pendingSourceDocs?: Document[];
  }>({
    messages: [
      {
        message: `Hallo, was möchtest du wissen?`,
        type: 'apiMessage',
      },
    ],
    history: [],
    pendingSourceDocs: [],
  });

  const { messages, pending, history, pendingSourceDocs } = messageState;

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Effects only run on the client, initially set focus to the text input 
  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  const abortAnswer = () => {
    if (abortController) {
      console.log("abort");
      abortController.abort();
    }
  };

  //handle form submission
  async function handleSubmit(e: any) {
    e.preventDefault();

    if (session.length == 0) {
      setSession((Date.now() % 630388217).toString());
    }

    setError(null);

    if (!query) {
      alert('Please input a question');
      return;
    }

    const question = query.trim();

    setMessageState((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          type: 'userMessage',
          message: question,
        },
      ],
      pending: undefined,
    }));

    setLoading(true);
    setQuery('');
    setMessageState((state) => ({ ...state, pending: '' }));

    const ctrl = new AbortController();
    setAbortController(ctrl);

    try {

      const chat: Chat = {
        session: session,
        contextName: currentContext,
        question,
        history: checkboxRef.current?.checked ? history : []
      }

      fetchEventSource(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chat),
        signal: ctrl.signal,
        onclose: () => {  console.log("onklose")    },
        onerror: (err: any) => { throw new Error(err) },  // ohne throw -> retry endlessly  
        onmessage: (event) => {          
          if (event.data === '[DONE]') {
            setMessageState((state) => ({
              history: [...state.history, [question, state.pending ?? '']],
              messages: [
                ...state.messages,
                {
                  type: 'apiMessage',
                  message: state.pending ?? '',
                  sourceDocs: state.pendingSourceDocs,
                },
              ],
              pending: undefined,
              pendingSourceDocs: undefined,
            }));
            setLoading(false);
            ctrl.abort();
          } else {
            const data = JSON.parse(event.data);
            if (data.sourceDocs) {
              setMessageState((state) => ({
                ...state,
                pendingSourceDocs: data.sourceDocs,
              }));
            } else {
              setMessageState((state) => ({
                ...state,
                pending: (state.pending ?? '') + data.data,
              }));
            }
          }
        },
      });
    } catch (error) {
      setLoading(false);
      setError('An error occurred while fetching the data. Please try again.');
      console.log('error', error);
    }
  }

  //prevent empty submissions
  const handleEnter = (e: any) => {
      if (e.key === 'Enter' && query) {
        handleSubmit(e);
      } else if (e.key == 'Enter') {
        e.preventDefault();
      }
    };

  const chatMessages = useMemo(() => {
    return [
      ...messages,
      ...(pending
        ? [
            {
              type: 'apiMessage',
              message: pending,
              sourceDocs: pendingSourceDocs,
            },
          ]
        : []),
    ];
  }, [messages, pending, pendingSourceDocs]);

  //scroll to bottom of chat after any chatMessages change
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const getContexts = async () => {
    const res = await fetch(`${API_URL}/contexts`, {    
      method: "GET",
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (res.ok) {
      return await res.json() as ContextInfo[];
    } else {
      alert( JSON.stringify( await res.json()) )
      return [];
    }
  }  

  useEffect(() => {   
    getContexts().then(result => {
      setUiContext(result);
      if (result.length > 0) {
        //setContextName(result.some(x => x.name == currentContext) ? currentContext : result[0].name);
      }      
    }); 
  }, []); // intentionally no dependencies surveillance -> []  ( called only initially on client side )

  return (
    <>
      <Layout>
        <div className="mx-auto flex flex-col gap-4">
          <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter flex items-center justify-center  ">
            <span className="mr-1">Chat mit</span> 
            <select value={currentContext} onChange={(e)=> {
              //setContextName(e.target.value);
              setCurrentContext(e.target.value);
              }}>
              {uiContext.map((context, index) => {
                return(
                        <option key={`option-${index}`} value={context.name}>
                          {context.name}
                        </option>
                      );
              })}
            </select>
            <div><span className='text-base font-normal ml-5 mr-2 '>Kontext berücksichtigen</span><input ref={checkboxRef} defaultChecked  className='justify-self-end' type='checkbox' id='bla' />   </div>                               
          </h1>

          <main className={styles.main}>
            <div className={styles.cloud}>
              <div ref={messageListRef} className={styles.messagelist}>
                {chatMessages.map((message, index) => {
                  let icon;
                  let className;
                  if (message.type === 'apiMessage') {
                    icon = (
                      <Image
                        src={botIcon}   //"/bot-image.png"
                        alt="AI"
                        width="40"
                        height="40"
                        className={styles.boticon}
                        onClick={abortAnswer}
                        priority
                      />
                    );
                    className = styles.apimessage;
                  } else {
                    icon = (
                      <Image
                        src={userIcon}   //"/usericon.png"
                        alt="Me"
                        width="30"
                        height="30"
                        className={styles.usericon}
                        priority
                      />
                    );
                    // The latest message sent by the user will be animated while waiting for a response
                    className =
                      loading && index === chatMessages.length - 1
                        ? styles.usermessagewaiting
                        : styles.usermessage;
                  }
                  return (
                    <>
                      <div key={`chatMessage-${index}`} className={className}>
                        {icon}
                        <div className={styles.markdownanswer}>
                          <ReactMarkdown linkTarget="_blank">
                            {message.message}
                          </ReactMarkdown>
                        </div>
                      </div>
                      {message.sourceDocs && (
                        <div
                          className="p-5"
                          key={`sourceDocsAccordion-${index}`}
                        >
                          <Accordion
                            type="single"
                            collapsible
                            className="flex-col"
                          >
                            {message.sourceDocs.map((doc, index) => (
                              <div key={`messageSourceDocs-${index}`}>
                                <AccordionItem value={`item-${index}`}>
                                  <AccordionTrigger>
                                    <h3>Source {index + 1}</h3>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <ReactMarkdown linkTarget="_blank">
                                      {doc.pageContent}
                                    </ReactMarkdown>
                                    <p className="mt-2">
                                      <b>Source:</b> {doc.metadata.source}
                                    </p>
                                  </AccordionContent>
                                </AccordionItem>
                              </div>
                            ))}
                          </Accordion>
                        </div>
                      )}
                    </>
                  );
                })}
                {sourceDocs.length > 0 && (
                  <div className="p-5">
                    <Accordion type="single" collapsible className="flex-col">
                      {sourceDocs.map((doc, index) => (
                        <div key={`SourceDocs-${index}`}>
                          <AccordionItem value={`item-${index}`}>
                            <AccordionTrigger>
                              <h3>Source {index + 1}</h3>
                            </AccordionTrigger>
                            <AccordionContent>
                              <ReactMarkdown linkTarget="_blank">
                                {doc.pageContent}
                              </ReactMarkdown>
                            </AccordionContent>
                          </AccordionItem>
                        </div>
                      ))}
                    </Accordion>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.center}>
              <div className={styles.cloudform}>
                <form onSubmit={handleSubmit}>
                  <textarea
                    disabled={loading}
                    onKeyDown={handleEnter}
                    ref={textAreaRef}
                    autoFocus={false}
                    rows={1}
                    maxLength={512}
                    id="userInput"
                    name="userInput"
                    placeholder={
                      loading
                        ? 'Waiting for response...'
                        : `Deine Frage ...`
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={styles.textarea}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.generatebutton}
                  >
                    {loading ? (
                      <div className={styles.loadingwheel}>
                        <LoadingDots color="#000" />
                      </div>
                    ) : (
                      // Send icon SVG in input field
                      <svg
                        viewBox="0 0 20 20"
                        className={styles.svgicon}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                      </svg>
                    )}
                  </button>
                </form>
              </div>
            </div>
            {error && (
              <div className="border border-red-400 rounded-md p-4">
                <p className="text-red-500">{error}</p>
              </div>
            )}
          </main>
        </div>
        <footer className="m-auto p-4">
          <a href={NEXT_PUBLIC_PROVIDER_URL()}>
            {NEXT_PUBLIC_PROVIDER_NAME()}
          </a>
        </footer>
      </Layout>
    </>
  );
}
