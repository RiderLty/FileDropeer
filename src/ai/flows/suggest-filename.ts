'use server';

/**
 * @fileOverview Provides filename suggestions using generative AI based on existing filenames.
 *
 * - suggestFilename - A function that suggests a filename.
 * - SuggestFilenameInput - The input type for the suggestFilename function.
 * - SuggestFilenameOutput - The return type for the suggestFilename function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestFilenameInputSchema = z.object({
  fileType: z.string().describe('The type of the file to be named (e.g., image, document).'),
  existingFilenames: z.string().describe('A comma separated string containing a list of existing filenames.'),
});
export type SuggestFilenameInput = z.infer<typeof SuggestFilenameInputSchema>;

const SuggestFilenameOutputSchema = z.object({
  suggestedFilename: z.string().describe('A suggested filename for the file.'),
});
export type SuggestFilenameOutput = z.infer<typeof SuggestFilenameOutputSchema>;

export async function suggestFilename(input: SuggestFilenameInput): Promise<SuggestFilenameOutput> {
  return suggestFilenameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestFilenamePrompt',
  input: {schema: SuggestFilenameInputSchema},
  output: {schema: SuggestFilenameOutputSchema},
  prompt: `You are an expert at suggesting filenames that are likely to result in successful retrievals.

You will be provided with the file type and a list of existing filenames. Based on this information, suggest a filename that is descriptive and unique.

File Type: {{{fileType}}}
Existing Filenames: {{{existingFilenames}}}

Suggested Filename:`, // No Handlebars IF/EACH constructs
});

const suggestFilenameFlow = ai.defineFlow(
  {
    name: 'suggestFilenameFlow',
    inputSchema: SuggestFilenameInputSchema,
    outputSchema: SuggestFilenameOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
