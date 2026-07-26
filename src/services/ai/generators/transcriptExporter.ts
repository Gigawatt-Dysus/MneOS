import { SimulacrumMessage } from './simulacrumGenerator';
import { appDataService } from '../../serviceManager';
import { Media } from '../../../types';

/**
 * Compiles a beautiful Markdown transcript of the simulation debate.
 */
const generateMarkdownTranscript = (
    sessionTitle: string,
    history: SimulacrumMessage[],
    participants: string[],
    speakerNameResolver?: (msg: SimulacrumMessage) => string
): string => {
    let md = `# ${sessionTitle}\n\n`;
    md += `**Simulation Transcript**\n`;
    md += `**Date:** ${new Date().toLocaleDateString()}\n`;
    md += `**Participants:** ${participants.join(', ')}\n\n`;
    md += `---\n\n`;

    history.forEach((msg) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        let speakerName = speakerNameResolver ? speakerNameResolver(msg) : 'Moderator';
        
        if (!speakerNameResolver) {
            if (msg.role === 'model' && msg.tagId) {
                speakerName = 'Construct';
            } else if (msg.role === 'user') {
                speakerName = 'Moderator';
            }
        }

        md += `### ${speakerName} \`[${time}]\`\n`;
        md += `${msg.content}\n\n`;
    });

    return md;
};

export const exportSimulationTranscript = async (
    userId: string,
    sessionTitle: string,
    history: SimulacrumMessage[],
    participants: string[],
    speakerNameResolver?: (msg: SimulacrumMessage) => string
) => {
    // 1. Generate Markdown String
    const mdContent = generateMarkdownTranscript(sessionTitle, history, participants, speakerNameResolver);

    // 2. Generate JSON String
    const jsonContent = JSON.stringify({
        sessionTitle,
        date: new Date().toISOString(),
        participants,
        history,
        metadata: {
            is_fiction: true,
            context_type: 'simulation_transcript'
        }
    }, null, 2);

    // 3. Convert both to Base64
    const mdBase64 = btoa(unescape(encodeURIComponent(mdContent)));
    const jsonBase64 = btoa(unescape(encodeURIComponent(jsonContent)));

    // 4. Create Media Artifacts
    const mdMedia: Media = {
        id: `media-${Date.now()}-md`,
        userId,
        url: '', // Stored as base64
        base64Data: `data:text/markdown;base64,${mdBase64}`,
        thumbnailUrl: '', // Not applicable
        caption: `${sessionTitle} - Markdown Transcript`,
        uploadDate: new Date(),
        fileType: 'text/markdown',
        fileName: `${sessionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.md`,
        tagIds: [],
        isFiction: true,
        status: 'clean',
        title: `${sessionTitle} Transcript`,
        description: `Exported simulation transcript between ${participants.join(' and ')}`,
        metadata: {
            is_fiction: true,
            context_type: 'simulation_transcript',
            participants
        }
    };

    const jsonMedia: Media = {
        id: `media-${Date.now()}-json`,
        userId,
        url: '',
        base64Data: `data:application/json;base64,${jsonBase64}`,
        thumbnailUrl: '',
        caption: `${sessionTitle} - JSON Transcript`,
        uploadDate: new Date(),
        fileType: 'application/json',
        fileName: `${sessionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.json`,
        tagIds: [],
        isFiction: true,
        status: 'clean',
        title: `${sessionTitle} Transcript (JSON)`,
        description: `Exported simulation structural data between ${participants.join(' and ')}`,
        metadata: {
            is_fiction: true,
            context_type: 'simulation_transcript',
            participants
        }
    };

    // 5. Save to Media Library
    if ((appDataService as any).stageArtifact) {
        await appDataService.stageArtifact(userId, mdMedia);
        await appDataService.stageArtifact(userId, jsonMedia);
    } else {
        await appDataService.saveMedia(userId, mdMedia);
        await appDataService.saveMedia(userId, jsonMedia);
    }

    return { mdMedia, jsonMedia };
};
