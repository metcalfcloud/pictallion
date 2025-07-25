# Ollama Setup for Pictallion

Pictallion uses Ollama for local AI-powered photo analysis. This allows you to run everything locally without needing external API keys.

## Installing Ollama

1. **Download and install Ollama** from [https://ollama.ai](https://ollama.ai)

2. **Pull the required models:**
   ```bash
   # For image analysis (vision model)
   ollama pull llava:latest
   
   # For text processing (optional, for tag generation)
   ollama pull llama3.2:latest
   ```

3. **Start Ollama service:**
   ```bash
   ollama serve
   ```
   This will start Ollama on `http://localhost:11434`

## Configuration

The application automatically detects if Ollama is running and falls back to basic metadata generation if it's not available.

### Environment Variables (Optional)

- `OLLAMA_BASE_URL`: Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL`: Vision model for image analysis (default: `llava:latest`)
- `OLLAMA_TEXT_MODEL`: Text model for tag generation (default: `llama3.2:latest`)

## How It Works

1. **With Ollama Running:**
   - Photos uploaded to Bronze tier get basic EXIF metadata
   - When processing Bronze → Silver, AI analyzes images with llava:latest
   - Generates tags, descriptions, object detection, and confidence scores
   - All processing happens locally on your machine

2. **Without Ollama:**
   - Photos still get EXIF metadata and basic filename-based tags
   - Manual processing is still available for Silver → Gold promotion
   - No external dependencies or API keys needed

## Recommended Models

- **llava:latest** (7B parameters): Best balance of speed and quality for image analysis
- **llava:13b**: Higher quality but slower processing
- **llama3.2:latest**: For text processing and tag generation

## Performance Tips

- Use GPU acceleration if available (Ollama automatically detects)
- Monitor memory usage with larger models
- Consider smaller models for faster processing on limited hardware

## Troubleshooting

1. **Ollama not detected:**
   - Check if Ollama is running: `curl http://localhost:11434/api/tags`
   - Verify models are installed: `ollama list`

2. **Slow processing:**
   - Use smaller models like `llava:7b`
   - Ensure GPU acceleration is working
   - Consider reducing image resolution for processing

3. **Memory issues:**
   - Close other applications
   - Use quantized models (Q4 versions)
   - Monitor system resources during processing