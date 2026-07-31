import { NextResponse } from 'next/server';

const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE;

function isAllowedRemoteHost(hostname: string): boolean {
  const envHost = (() => {
    if (!R2_PUBLIC_BASE) return '';
    try {
      return new URL(R2_PUBLIC_BASE).hostname;
    } catch {
      return '';
    }
  })();

  if (envHost && hostname === envHost) return true;
  return hostname.endsWith('.r2.dev');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assetUrl = searchParams.get('url');

    if (!assetUrl) {
      return NextResponse.json({ error: 'Falta la URL del archivo' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(assetUrl);
    } catch {
      return NextResponse.json({ error: 'La URL del archivo no es válida' }, { status: 400 });
    }

    if (!isAllowedRemoteHost(parsedUrl.hostname)) {
      return NextResponse.json({ error: 'El host remoto no está permitido' }, { status: 400 });
    }

    const upstreamResponse = await fetch(parsedUrl.toString(), {
      method: 'GET',
      cache: 'no-store',
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: `No se pudo descargar el archivo remoto (${upstreamResponse.status})` },
        { status: 502 }
      );
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await upstreamResponse.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[remote-asset] Error al obtener archivo remoto:', error);
    return NextResponse.json({ error: 'No se pudo obtener el archivo remoto' }, { status: 500 });
  }
}
