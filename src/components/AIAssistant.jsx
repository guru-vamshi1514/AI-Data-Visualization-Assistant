import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Send,
  Loader2,
  TrendingUp,
  AlertCircle,
  Sparkles,
  HelpCircle,
  PlusCircle,
  Clock,
  CheckCircle2,
  Mic,
  MicOff,
} from 'lucide-react'

export default function AIAssistant({
  messages,
  question,
  setQuestion,
  onAsk,
  asking,
  hasDataset,
}) {
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, asking])

  const suggestedQuestions = [
    { text: 'What category has the highest sales?', icon: PlusCircle },
    { text: 'Show sales trend by date', icon: TrendingUp },
    { text: 'Are there any outliers?', icon: AlertCircle },
    { text: 'Which category performs the best?', icon: PlusCircle },
    { text: 'Generate key insights from this data', icon: Sparkles },
  ]

  function handleSuggestionClick(suggestedText) {
    onAsk(suggestedText)
  }

  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((res) => res[0].transcript)
          .join('')
        setQuestion(transcript)
      }

      recognition.onerror = (err) => {
        console.warn('Speech recognition error:', err)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('Speech recognition start failed:', err)
      setIsListening(false)
    }
  }

  return (
    <div className="panel ai-analyst-panel" id="ai-analyst-panel">
      {/* Panel Header */}
      <div className="ai-analyst-header">
        <div className="ai-header-title-group">
          <div className="ai-analyst-icon-wrapper">
            <Bot size={20} className="ai-bot-icon" />
          </div>
          <h2 className="ai-analyst-title">AI Analyst</h2>
        </div>
        <div className="ai-online-status-pill">
          <span className="online-dot" />
          <span>Online</span>
        </div>
      </div>

      {/* Assistant Intro Message Bubble */}
      <div className="ai-intro-bubble">
        <p>
          Hi! I&apos;m your AI Data Analyst. I can help you explore your dataset,
          find insights, create visualizations and answer your questions.
        </p>
      </div>

      {/* Suggested Questions Section */}
      <div className="ai-suggestions-container">
        <div className="ai-suggestions-title">
          <span>Try asking:</span>
          <span className="suggestions-chevron">&gt;</span>
        </div>
        <div className="ai-suggestions-list">
          {suggestedQuestions.map((item, idx) => {
            const Icon = item.icon
            return (
              <button
                key={idx}
                type="button"
                className="ai-suggestion-chip"
                onClick={() => handleSuggestionClick(item.text)}
                disabled={asking}
              >
                <Icon size={12} className="chip-icon" />
                <span>{item.text}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Chat Messages Stream (Scrollable) */}
      <div className="ai-chat-stream">
        {messages.map((message, index) => {
          const isUser = message.role === 'user'
          return (
            <div
              key={`${message.role}-${index}`}
              className={`ai-message-row ${isUser ? 'user-row' : 'assistant-row'}`}
            >
              <div className={`ai-message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
                <p className="message-text">{message.content}</p>
                <div className="message-meta">
                  {message.source && (
                    <span className="message-source">
                      <CheckCircle2 size={10} /> {message.source}
                    </span>
                  )}
                  {message.timestamp && (
                    <span className="message-time">
                      <Clock size={10} /> {message.timestamp}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {asking && (
          <div className="ai-message-row assistant-row">
            <div className="ai-message-bubble assistant-bubble typing-bubble">
              <span className="typing-label">Analyzing dataset...</span>
              <div className="typing-dots">
                <span className="tdot" />
                <span className="tdot" />
                <span className="tdot" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Voice Status Banner */}
      {isListening && (
        <div className="ai-voice-listening-banner">
          <span className="voice-pulse-dot" />
          <span>Listening to your voice... speak now</span>
        </div>
      )}

      {/* Ask Form */}
      <form
        className="ai-ask-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (question.trim()) {
            if (isListening) {
              recognitionRef.current?.stop()
              setIsListening(false)
            }
            onAsk(question)
          }
        }}
      >
        <div className="ai-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="ai-chat-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              isListening
                ? 'Listening to your speech...'
                : hasDataset
                ? 'Ask a question about your data...'
                : 'Upload a dataset to ask questions...'
            }
            disabled={asking}
          />
          {/* Voice Input Button */}
          <button
            type="button"
            className={`ai-voice-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleVoiceInput}
            title={isListening ? 'Stop listening' : 'Ask question by voice (Speech-to-Text)'}
            aria-label="Voice input"
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            type="submit"
            className="ai-send-btn"
            disabled={!question.trim() || asking}
            title="Send query"
          >
            {asking ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
      </form>
    </div>
  )
}
