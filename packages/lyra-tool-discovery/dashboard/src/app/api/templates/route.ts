import { NextResponse } from 'next/server';
import { TEMPLATES } from '@/lib/constants';

export async function GET() {
  // Return all templates with full metadata
  const templates = TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    type: template.type,
    icon: template.icon,
    description: template.description,
    useCase: template.useCase,
    criteria: template.criteria,
    example: template.example,
    cliCommand: template.cliCommand,
  }));

  return NextResponse.json({
    count: templates.length,
    templates,
  });
}
