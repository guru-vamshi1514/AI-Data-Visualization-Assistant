import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'

export default function UploadCard({ onUploadFile, loading }) {
  const fileInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  function handleDrag(e) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadFile(e.dataTransfer.files[0])
    }
  }

  function handleChange(e) {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0])
      e.target.value = ''
    }
  }

  function handleClick() {
    fileInputRef.current?.click()
  }

  return (
    <div
      className={`upload-csv-card ${dragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/json"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      <div className="upload-icon-circle">
        <UploadCloud size={28} className="upload-cloud-icon" />
      </div>

      <div className="upload-text-content">
        <h3 className="upload-title">Upload Dataset</h3>
        <p className="upload-subtitle">
          Drag & drop your file here, or click to browse.
        </p>
        <span className="upload-support-text">
          Supports .csv, .xlsx, .xls, .json files
        </span>
      </div>

      <button
        type="button"
        className="upload-choose-btn"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Choose File'}
      </button>
    </div>
  )
}
