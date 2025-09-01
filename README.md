# beckyschmidt.me

**Personal website and blog for Becky Schmidt** - Product Manager, indie creator, and AI enthusiast.

🌐 **Live Site:** [beckyschmidt.me](https://beckyschmidt.me)

## ✨ Unique Features

This isn't just another Astro blog - it's packed with custom functionality:

### 🎯 **GitHub-Integrated CMS**
- **Admin Dashboard**: Password-protected admin interface at `/admin`
- **Branch Management**: Create and manage blog posts across different Git branches
- **Live Editing**: Built-in Markdown editor with CodeMirror
- **Pull Request Workflow**: Automatically create PRs for blog post changes
- **Multi-branch Publishing**: Write drafts on feature branches, publish to main

### 🤝 **Real-time Blog Reactions**
- **Convex Integration**: Real-time reaction system using Convex backend
- **Rate Limiting**: Built-in spam protection and rate limiting
- **Per-user Tracking**: Unique client ID system prevents duplicate reactions
- **Live Updates**: Reactions update in real-time across all visitors

### 🔍 **Advanced Search & Discovery**
- **Pagefind Integration**: Full-text search across all content
- **Tag System**: Categorized blog posts with tag filtering
- **RSS Feed**: Auto-generated RSS for blog subscribers
- **Sitemap**: SEO-optimized sitemap generation

### 📚 **Slash Pages Collection**
- **Personal Pages**: `/uses`, `/stack`, `/resume`, `/slash-pages`
- **Inspired by slashpages.net**: Curated personal information pages
- **Project Showcase**: Detailed project cards with tech stacks and descriptions

### 🎨 **Enhanced UX**
- **Dark/Light Mode**: Theme toggle with system preference detection
- **Reading Time**: Automatic reading time calculation for blog posts
- **Responsive Design**: Mobile-first Tailwind CSS implementation
- **Typography**: Custom font integration (Carlito via Fontsource)

### 🏗️ **Modern Tech Stack**
- **Astro 5.x**: Latest static site generation with islands architecture
- **React Integration**: Interactive components where needed
- **Tailwind CSS 4.x**: Latest utility-first CSS framework
- **Convex**: Real-time backend for reactions and data
- **Netlify**: Deployment with serverless functions
- **GitHub API**: Headless CMS functionality

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or pnpm
- Convex account (for reactions feature)
- GitHub token (for CMS functionality)

### Environment Variables
Create a `.env` file with:

```bash
CONVEX_URL=your_convex_deployment_url
ADMIN_PASSWORD=your_admin_password
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
```

### Commands

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts Convex + Netlify dev server              |
| `npm run astro-dev`       | Astro dev server only (without Convex)          |
| `npm run build`           | Build production site to `./dist/`              |
| `npm run preview`         | Preview build locally                            |

## 🚀 Deployment

This site is deployed on **Netlify** with:
- Automatic builds from the `master` branch
- Serverless functions for GitHub API integration
- Environment variables for secure token management
- Built-in form handling for contact functionality

## 📁 Project Structure

```text
/
├── src/
│   ├── components/          # React & Astro components
│   │   ├── AdminDashboard.tsx    # GitHub CMS admin
│   │   ├── ReactionApp.tsx       # Blog reactions
│   │   └── ...
│   ├── pages/
│   │   ├── api/            # Netlify serverless functions
│   │   │   ├── github/     # GitHub integration endpoints
│   │   │   └── auth.ts     # Admin authentication
│   │   ├── admin.astro     # CMS dashboard
│   │   ├── blog/           # Blog pages & dynamic routes
│   │   └── ...
│   ├── blog/               # Markdown blog posts
│   ├── layouts/            # Page layouts
│   └── utils/              # Utility functions
├── convex/                 # Convex backend functions
│   ├── reactions.ts        # Reaction system logic
│   └── schema.ts          # Database schema
└── public/                # Static assets
```

## 💡 Blog Features

- **Frontmatter Support**: Title, description, tags, publish date
- **Markdown Extensions**: TOC generation, reading time, syntax highlighting
- **Dynamic Routing**: Automatic slug generation and tag pages
- **SEO Optimized**: Meta tags, Open Graph, structured data
- **Interactive Elements**: Real-time reactions, search functionality

## 🎨 Customization

The site is highly customizable through:
- **Site Config** (`src/siteConfig.ts`): Personal information, navigation, socials
- **Tailwind Config**: Custom color schemes and design tokens  
- **Content Collections**: Type-safe blog post management
- **Component Library**: Reusable UI components

## 📝 Content Management

Two ways to create content:
1. **Admin Dashboard**: Use `/admin` for GUI-based editing with branch management
2. **Direct Editing**: Edit Markdown files in `src/blog/` directory

## 🤝 Contributing

This is a personal website, but feel free to:
- Open issues for bugs or suggestions
- Fork and adapt for your own use
- Reference implementation details for your projects

---

**Built with ❤️ by [Becky Schmidt](https://beckyschmidt.me)**
