import { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";
import type { QuaggaJSResultObject } from "@ericblade/quagga2";

export default function BarcodeScanner() {
    const scannerRef = useRef<HTMLDivElement>(null);
    const [codes, setCodes] = useState<string[]>([]); // Agora guarda uma lista
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Usamos uma ref para evitar que o Quagga adicione o mesmo código repetidamente
    // em milissegundos (já que ele processa vários frames por segundo)
    const lastScannedCode = useRef<string | null>(null);
    const lastScannedTime = useRef<number>(0);

    useEffect(() => {
        if (!scannerRef.current) return;

        let isCancelled = false;

        Quagga.init(
            {
                inputStream: {
                    type: "LiveStream",
                    target: scannerRef.current,
                    constraints: {
                        facingMode: "environment",
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    willReadFrequently: true,
                },
                locator: {
                    patchSize: "medium",
                    halfSample: true,
                },
                decoder: {
                    readers: ["ean_reader", "ean_8_reader", "upc_reader", "code_128_reader"],
                },
                locate: true,
            },
            (err) => {
                if (isCancelled) return;

                if (err) {
                    console.error("Erro na inicialização do Quagga:", err);
                    setError(err.message || "Falha ao acessar a câmera.");
                    return;
                }

                const video = scannerRef.current?.querySelector("video");
                if (!video) {
                    setError("Elemento de vídeo não encontrado.");
                    return;
                }

                const startScanning = () => {
                    if (isCancelled) return;

                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                        console.log(`Vídeo pronto: ${video.videoWidth}x${video.videoHeight}. Iniciando Quagga.`);
                        Quagga.start();
                        setIsReady(true);
                    } else {
                        setTimeout(startScanning, 100);
                    }
                };

                if (video.readyState >= 1) {
                    startScanning();
                } else {
                    video.addEventListener("loadedmetadata", startScanning, {
                        once: true,
                    });
                }
            },
        );

        const handleDetected = (data: QuaggaJSResultObject) => {
            const code = data.codeResult?.code;
            if (!code) return;

            const now = Date.now();

            // Se o código for igual ao último lido E o tempo for menor que 2 segundos,
            // ignoramos para não encher a lista com o mesmo código.
            if (code === lastScannedCode.current && now - lastScannedTime.current < 2000) {
                return;
            }

            console.log("--- CÓDIGO DETECTADO ---");
            console.log("Valor:", code);
            console.log("Formato:", data.codeResult.format);

            // Atualiza a referência de controle
            lastScannedCode.current = code;
            lastScannedTime.current = now;

            // Adiciona o novo código no final da lista
            setCodes((prevCodes) => [...prevCodes, code]);
        };

        Quagga.onDetected(handleDetected);

        return () => {
            isCancelled = true;
            Quagga.offDetected(handleDetected);
            Quagga.stop();
        };
    }, []);

    // Função para limpar a lista de códigos (útil para testes)
    const clearList = () => {
        setCodes([]);
        lastScannedCode.current = null;
        lastScannedTime.current = 0;
    };

    return (
        <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
            <h2>Scanner de Código de Barras</h2>

            <p style={{ fontSize: "13px", color: "#666" }}>Status: {error ? "❌ Erro" : isReady ? "✅ Pronto para escanear" : "⏳ Inicializando câmera..."}</p>

            <div
                id="interactive"
                ref={scannerRef}
                style={{
                    width: "100%",
                    maxWidth: "500px",
                    height: "300px",
                    border: "2px solid #ccc",
                    borderRadius: "8px",
                    overflow: "hidden",
                    backgroundColor: "#000",
                    position: "relative",
                }}
            />

            {error && <p style={{ color: "red", marginTop: "10px" }}>Erro: {error}</p>}

            {/* Lista de códigos lidos */}
            {codes.length > 0 && (
                <div
                    style={{
                        marginTop: "20px",
                        padding: "15px",
                        background: "#f5f5f5",
                        borderRadius: "5px",
                        border: "1px solid #ccc",
                        maxWidth: "500px",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px" }}>Histórico de Leituras</h3>
                        <button
                            onClick={clearList}
                            style={{
                                padding: "5px 10px",
                                fontSize: "12px",
                                cursor: "pointer",
                                background: "#fff",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                            }}
                        >
                            Limpar Lista
                        </button>
                    </div>

                    <ul style={{ margin: 0, paddingLeft: "20px", fontFamily: "monospace", fontSize: "16px" }}>
                        {codes.map((code, index) => (
                            <li key={`${code}-${index}`} style={{ padding: "4px 0", borderBottom: "1px solid #eaeaea" }}>
                                {code}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>Aponte a câmera para o código de barras do refrigerante. O resultado aparecerá no console e na lista acima.</p>
        </div>
    );
}
