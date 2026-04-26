import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const STORAGE_KEY = 'lista-compras-api-key'

function obtenerApiKey() {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export default function App() {
  const [apiKey, setApiKey] = useState(obtenerApiKey)
  const [productos, setProductos] = useState([])
  const [nombre, setNombre] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [precio, setPrecio] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const headers = () => ({
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  })

  const cargarProductos = async () => {
    if (!apiKey) return
    try {
      setCargando(true)
      setError(null)
      const res = await fetch(`${API_URL}/productos`, { headers: headers() })
      if (res.status === 401) {
        setError('Token inválido. Hacé clic en "Cambiar token".')
        setProductos([])
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProductos(data)
    } catch (err) {
      setError(`No se pudo conectar: ${err.message}`)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarProductos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  const guardarApiKey = (e) => {
    e.preventDefault()
    const valor = new FormData(e.currentTarget).get('apikey')?.toString().trim()
    if (!valor) return
    localStorage.setItem(STORAGE_KEY, valor)
    setApiKey(valor)
  }

  const cambiarApiKey = () => {
    localStorage.removeItem(STORAGE_KEY)
    setApiKey('')
    setProductos([])
    setError(null)
  }

  const agregar = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) return
    try {
      const res = await fetch(`${API_URL}/productos`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          nombre: nombre.trim(),
          cantidad: Number(cantidad) || 1,
          precio: Number(precio) || 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setNombre('')
      setCantidad(1)
      setPrecio('')
      await cargarProductos()
    } catch (err) {
      setError(`Error al agregar: ${err.message}`)
    }
  }

  const eliminar = async (id) => {
    try {
      const res = await fetch(`${API_URL}/productos/${id}`, {
        method: 'DELETE',
        headers: headers(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setProductos((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(`Error al eliminar: ${err.message}`)
    }
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <form
          onSubmit={guardarApiKey}
          className="bg-white rounded-lg shadow p-6 w-full max-w-sm space-y-4"
        >
          <h1 className="text-lg font-bold">Acceso</h1>
          <p className="text-sm text-gray-600">
            Pegá el token de acceso (API key). Se guarda en este navegador.
          </p>
          <input
            name="apikey"
            type="password"
            autoComplete="off"
            placeholder="Token"
            className="w-full border rounded px-3 py-2"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold active:bg-blue-700"
          >
            Entrar
          </button>
        </form>
      </div>
    )
  }

  const total = productos.reduce(
    (acc, p) => acc + Number(p.precio || 0) * Number(p.cantidad || 1),
    0,
  )

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow flex items-center justify-between">
        <h1 className="text-lg font-bold">Mi Lista de Supermercado</h1>
        <button
          onClick={cambiarApiKey}
          className="text-xs bg-blue-700 px-2 py-1 rounded active:bg-blue-800"
        >
          Cambiar token
        </button>
      </header>

      <main className="max-w-md mx-auto p-4">
        <form onSubmit={agregar} className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
          <input
            type="text"
            placeholder="Producto"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={200}
            className="w-full border rounded px-3 py-2 text-base"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max="100000"
              placeholder="Cantidad"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-1/2 border rounded px-3 py-2 text-base"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Precio"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-1/2 border rounded px-3 py-2 text-base"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold active:bg-blue-700"
          >
            Agregar
          </button>
        </form>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {cargando ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : productos.length === 0 ? (
          <p className="text-center text-gray-500">No hay productos en la lista.</p>
        ) : (
          <ul className="space-y-2">
            {productos.map((p) => (
              <li
                key={p.id}
                className="bg-white rounded-lg shadow p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold">{p.nombre}</div>
                  <div className="text-sm text-gray-500">
                    {p.cantidad} x ${Number(p.precio).toFixed(2)}
                  </div>
                </div>
                <button
                  onClick={() => eliminar(p.id)}
                  className="text-red-600 font-semibold px-3 py-1 active:bg-red-50 rounded"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}

        {productos.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow p-4 text-right">
            <span className="text-gray-600">Total: </span>
            <span className="font-bold text-lg">${total.toFixed(2)}</span>
          </div>
        )}
      </main>
    </div>
  )
}
