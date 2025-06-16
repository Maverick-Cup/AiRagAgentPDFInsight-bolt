import { Handler } from '@netlify/functions';

interface LLMRequest {
  prompt: string;
  context?: string;
  documentType?: string;
}

interface HuggingFaceResponse {
  generated_text?: string;
  error?: string;
}

const handler: Handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const apiKey = process.env.HUGGING_FACE_API_KEY;
    
    if (!apiKey) {
      console.error('HUGGING_FACE_API_KEY not configured');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'LLM service configuration error. Please check server configuration.' 
        }),
      };
    }

    const requestBody: LLMRequest = JSON.parse(event.body || '{}');
    const { prompt, context, documentType } = requestBody;

    if (!prompt || typeof prompt !== 'string') {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid prompt provided' }),
      };
    }

    // Sanitize and prepare the input
    const sanitizedPrompt = prompt.trim().substring(0, 2000); // Limit prompt length
    const sanitizedContext = context ? context.trim().substring(0, 3000) : '';

    // Construct the full prompt for the model
    let fullPrompt = '';
    
    if (sanitizedContext) {
      fullPrompt = `Context from ${documentType || 'document'}:\n${sanitizedContext}\n\nQuestion: ${sanitizedPrompt}\n\nAnswer:`;
    } else {
      fullPrompt = `Question: ${sanitizedPrompt}\n\nAnswer:`;
    }

    console.log('Making request to Hugging Face API...');
    
    // Make request to Hugging Face Inference API
    const response = await fetch(
      'https://api-inference.huggingface.co/models/lmsys/fastchat-t5-3b-v1.0',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: 512,
            temperature: 0.7,
            do_sample: true,
            top_p: 0.9,
            repetition_penalty: 1.1,
          },
          options: {
            wait_for_model: true,
            use_cache: false,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', response.status, errorText);
      
      if (response.status === 503) {
        return {
          statusCode: 503,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            error: 'The AI model is currently loading. Please try again in a few moments.',
            retryAfter: 20
          }),
        };
      }
      
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Failed to get response from AI service. Please try again.' 
        }),
      };
    }

    const result: HuggingFaceResponse[] = await response.json();
    
    if (!result || !Array.isArray(result) || result.length === 0) {
      console.error('Invalid response format from Hugging Face:', result);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Invalid response from AI service. Please try again.' 
        }),
      };
    }

    const generatedText = result[0]?.generated_text || '';
    
    // Extract only the answer part (after "Answer:")
    let cleanedResponse = generatedText;
    const answerIndex = generatedText.indexOf('Answer:');
    if (answerIndex !== -1) {
      cleanedResponse = generatedText.substring(answerIndex + 7).trim();
    }
    
    // Remove any repetition of the original prompt
    if (cleanedResponse.startsWith(sanitizedPrompt)) {
      cleanedResponse = cleanedResponse.substring(sanitizedPrompt.length).trim();
    }
    
    // Ensure we have a meaningful response
    if (!cleanedResponse || cleanedResponse.length < 10) {
      cleanedResponse = "I understand your question, but I need more specific information to provide a detailed answer. Could you please rephrase your question or provide more context?";
    }

    console.log('Successfully generated response');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        response: cleanedResponse,
        model: 'lmsys/fastchat-t5-3b-v1.0'
      }),
    };

  } catch (error) {
    console.error('Error in LLM proxy function:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Internal server error. Please try again later.' 
      }),
    };
  }
};

export { handler };