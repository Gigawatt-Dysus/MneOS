import { jsPDF } from "jspdf";
import { User, ResumeStyleConfig, CareerNode } from "../../types";

// [ZEN] Accessibility Guard: Ensure contrast for low-vision users
const getReadableColor = (hex: string): string => {
    // If it's pure emerald green from the old preset, darken it to a professional forest green
    if (hex.toLowerCase() === '#10b981') return '#065f46'; 

    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    // sRGB to Luminance
    const a = [r, g, b].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const L = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    const ratio = (1 + 0.05) / (L + 0.05);

    // If contrast against white is < 4.5, force it to a very dark gray/black variant of the color
    if (ratio < 4.5) {
        console.warn(`[AccessibilityGuard] Contrast ratio ${ratio.toFixed(2)} too low. Hard-correcting to High-Contrast variant.`);
        return '#1e293b'; // SLATE-800 - Professional & Deep
    }
    return hex;
};

// [ZEN] Font Normalizer
const getSafeFont = (fontFamily: string) => {
    const map: Record<string, string> = {
        'times': 'times',
        'serif': 'times',
        'helvetica': 'helvetica',
        'sans': 'helvetica',
        'courier': 'courier',
        'mono': 'courier'
    };
    return map[fontFamily.toLowerCase()] || 'helvetica';
};

export const generateExecutiveResume = async (
    user: User,
    content: { headline: string; summary: string },
    style: ResumeStyleConfig
): Promise<Blob> => {
    const doc = new jsPDF({
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const { top, right, bottom, left } = style.margins;
    const innerWidth = pageWidth - left - right;
    
    // Accessibility Guard Application
    const safeAccentColor = getReadableColor(style.accentColor || '#10b981');
    const safeFont = getSafeFont(style.fontFamily || 'helvetica');

    let yPos = top;

    // Helper: Add text with wrapping
    const addWrappedText = (text: string, fontSize: number, fontFace: string, color: string = '#000000', bold: boolean = false) => {
        doc.setFont(safeFont, bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(color);
        
        const lines = doc.splitTextToSize(text, innerWidth);
        doc.text(lines, left, yPos);
        yPos += (lines.length * (fontSize * 0.4)) + 2; // Dynamic spacing
    };

    // --- 1. HEADER (Identity & Mandate) ---
    const fullName = `${user.preferredName || user.firstName} ${user.lastName}`;
    doc.setFont(safeFont, 'bold');
    doc.setFontSize(style.headerSize);
    doc.setTextColor('#000000');
    doc.text(fullName.toUpperCase(), left, yPos);
    yPos += (style.headerSize * 0.4) + 2;

    // Headline
    doc.setFont(safeFont, 'normal');
    const headlineSize = Math.max(12, style.bodySize + 2);
    doc.setFontSize(headlineSize);
    doc.setTextColor(safeAccentColor);
    doc.text(content.headline, left, yPos);
    yPos += (headlineSize * 0.4) + 6;

    // Contact Info Bar
    doc.setFontSize(9);
    doc.setTextColor('#475569');
    const contactLine = `${user.email} | ${user.phoneNumber || ''} | ${user.address?.city || ''}, ${user.address?.state || ''} | gigiwatt.com/ats/${user.publicSlug || ''}`;
    doc.text(contactLine, left, yPos);
    
    yPos += 8;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(left, yPos, pageWidth - right, yPos);
    yPos += 10;

    // --- 2. SUMMARY ---
    doc.setFont(safeFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor('#000000');
    doc.text("EXECUTIVE SUMMARY", left, yPos);
    yPos += 6;
    
    addWrappedText(content.summary, style.bodySize, safeFont, '#1e293b');
    yPos += 8;

    // 3. SECTIONS DATA PREP
    const activeNodes = (user.careerNodes || [])
        .filter(n => !n.excludeFromResume)
        .sort((a, b) => {
            const dateA = a.endDate === 'Present' ? new Date().getTime() : new Date(a.endDate).getTime();
            const dateB = b.endDate === 'Present' ? new Date().getTime() : new Date(b.endDate).getTime();
            return dateB - dateA;
        });

    const lookback = user.atsSettings?.lookbackYears || 'all';
    const finalNodes = lookback === 'all' 
        ? activeNodes 
        : activeNodes.filter(n => {
            const endYear = n.endDate === 'Present' ? new Date().getFullYear() : new Date(n.endDate).getFullYear();
            return (new Date().getFullYear() - (endYear || 0)) <= (lookback as number);
        });

    // Partition by Type
    const jobNodes = finalNodes.filter(n => n.type?.toLowerCase().includes('job') || n.type?.toLowerCase() === 'work');
    const eduNodes = finalNodes.filter(n => n.type?.toLowerCase().includes('education') || n.type?.toLowerCase() === 'academic');
    const skillNodes = finalNodes.filter(n => n.type?.toLowerCase().includes('skill') || n.type?.toLowerCase().includes('cert'));

    // Helper: Add Section Header
    const addSectionHeader = (title: string) => {
        if (yPos > pageHeight - bottom - 30) {
            doc.addPage();
            yPos = top;
        }
        yPos += 4;
        doc.setFont(safeFont, 'bold');
        doc.setFontSize(10);
        doc.setTextColor('#000000');
        doc.text(title.toUpperCase(), left, yPos);
        yPos += 2;
        doc.setDrawColor(230, 230, 230);
        doc.line(left, yPos, left + 20, yPos); // Small accent line
        yPos += 6;
    };

    // Helper: Render Node Group
    const renderNodeGroup = (nodes: CareerNode[]) => {
        nodes.forEach(node => {
            if (yPos > pageHeight - bottom - 20) {
                doc.addPage();
                yPos = top;
            }

            doc.setFontSize(style.bodySize);
            doc.setFont(safeFont, 'bold');
            doc.setTextColor('#000000');
            doc.text(node.title, left, yPos);
            
            doc.setFont(safeFont, 'normal');
            const dateStr = `${node.startDate} - ${node.endDate}`;
            const dateWidth = doc.getTextWidth(dateStr);
            doc.text(dateStr, pageWidth - right - dateWidth, yPos);
            
            yPos += (style.bodySize * 0.4) + 1;
            doc.setFont(safeFont, 'bold');
            doc.setTextColor(safeAccentColor);
            doc.text(node.organization, left, yPos);
            yPos += (style.bodySize * 0.4) + 4;

            doc.setFont(safeFont, 'normal');
            doc.setFontSize(style.bodySize - 0.5);
            doc.setTextColor('#334155');
            
            (node.bullets || []).forEach(bullet => {
                if (yPos > pageHeight - bottom - 10) {
                    doc.addPage();
                    yPos = top;
                }
                const bulletPrefix = "• ";
                const splitBullet = doc.splitTextToSize(bullet, innerWidth - 5);
                doc.text(bulletPrefix, left, yPos);
                doc.text(splitBullet, left + 4, yPos);
                yPos += (splitBullet.length * ((style.bodySize - 0.5) * 0.4)) + 2;
            });
            yPos += 4;
        });
    };

    // --- RENDER SECTIONS ---
    if (jobNodes.length > 0) {
        addSectionHeader("Professional Experience");
        renderNodeGroup(jobNodes);
    }

    if (eduNodes.length > 0) {
        addSectionHeader("Education");
        renderNodeGroup(eduNodes);
    }

    if (skillNodes.length > 0) {
        addSectionHeader("Skills & Certifications");
        renderNodeGroup(skillNodes);
    }

    // --- 4. SIGNATURE / FOOTER ---
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#64748b'); // Slate-500: Professional & Legible
        doc.text(`${user.firstName} ${user.lastName} | Executive Briefing | Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    }

    return doc.output("blob");
};
