import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Download,
  FileText,
  HelpCircle,
  Home,
  Settings,
} from 'lucide-react';

const MORE_ITEMS = [
  {
    to: '/demo/actions',
    title: 'Actions',
    subtitle: 'Educational sleep steps and measurement context checks',
    icon: FileText,
  },
  {
    to: '/demo/reports',
    title: 'Reports',
    subtitle: 'Filtered JSON, CSV, and Light A4 printable reports',
    icon: Download,
  },
  {
    to: '/demo/sources',
    title: 'Sources',
    subtitle: 'Offline cached NASA, CSA, CDC, and NIST evidence summaries',
    icon: BookOpen,
  },
  {
    to: '/demo/settings',
    title: 'Settings',
    subtitle: 'Appearance, units, persistence, backup restore & CSV import',
    icon: Settings,
  },
  {
    to: '/demo/help',
    title: 'Help',
    subtitle: 'Offline boundaries and approved onboard procedure note',
    icon: HelpCircle,
  },
  {
    to: '/',
    title: 'Public landing page',
    subtitle: 'Return to project introduction and platform architecture',
    icon: Home,
  },
] as const;

export function MorePage() {
  return (
    <div className="cs-stack" style={{ gap: '16px' }}>
      <header className="cs-page-header" style={{ marginBottom: 0 }}>
        <div>
          <span className="cs-mono-stamp">Navigation Hub</span>
          <h1 className="cs-page-title" style={{ marginTop: '4px' }}>
            More
          </h1>
        </div>
      </header>

      <div className="cs-stack" style={{ gap: '10px' }}>
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="cs-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                textDecoration: 'none',
                minHeight: '56px',
              }}
            >
              <Icon size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 500 }}>{item.title}</div>
                <div className="cs-helper">{item.subtitle}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
