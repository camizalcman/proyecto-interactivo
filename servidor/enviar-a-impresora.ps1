# ─────────────────────────────────────────────────────────────
# ENVIAR A IMPRESORA
# Manda un archivo de bytes tal cual (comandos ESC/POS) a una impresora USB,
# hablándole directo al dispositivo: no hace falta instalar un driver ni crear
# una cola de impresión en Windows.
# Lo usa servidor.js. Uso manual:
#   powershell -ExecutionPolicy Bypass -File enviar-a-impresora.ps1 ticket.bin vid_0483&pid_070b
# ─────────────────────────────────────────────────────────────
param(
  [Parameter(Mandatory = $true)][string]$Archivo,
  [Parameter(Mandatory = $true)][string]$Dispositivo  # texto que identifica a la impresora (VID y PID)
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8  # para que los errores lleguen con acentos a Node

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public static class ImpresoraUsb {
  // Identificador con el que Windows publica las impresoras USB (driver usbprint)
  static Guid GUID_USBPRINT = new Guid("28d78fad-5a12-11d1-ae5b-0000f803a8c2");
  const int DIGCF_PRESENT = 0x02, DIGCF_DEVICEINTERFACE = 0x10;
  const uint GENERIC_WRITE = 0x40000000, OPEN_EXISTING = 3;
  const uint FILE_SHARE_READ = 1, FILE_SHARE_WRITE = 2;

  [StructLayout(LayoutKind.Sequential)]
  struct SP_DEVICE_INTERFACE_DATA {
    public int cbSize; public Guid InterfaceClassGuid; public int Flags; public IntPtr Reserved;
  }

  [DllImport("setupapi.dll", SetLastError = true)]
  static extern IntPtr SetupDiGetClassDevs(ref Guid g, IntPtr e, IntPtr h, int flags);
  [DllImport("setupapi.dll", SetLastError = true)]
  static extern bool SetupDiEnumDeviceInterfaces(IntPtr s, IntPtr d, ref Guid g, int i, ref SP_DEVICE_INTERFACE_DATA data);
  [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr s, ref SP_DEVICE_INTERFACE_DATA data, IntPtr detalle, int tam, out int necesario, IntPtr info);
  [DllImport("setupapi.dll")]
  static extern bool SetupDiDestroyDeviceInfoList(IntPtr s);
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern SafeFileHandle CreateFile(string nombre, uint acceso, uint compartir, IntPtr seg, uint modo, uint flags, IntPtr plantilla);

  public static List<string> Listar() {
    List<string> rutas = new List<string>();
    IntPtr lista = SetupDiGetClassDevs(ref GUID_USBPRINT, IntPtr.Zero, IntPtr.Zero, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
    if (lista == new IntPtr(-1)) throw new Win32Exception();
    try {
      SP_DEVICE_INTERFACE_DATA data = new SP_DEVICE_INTERFACE_DATA();
      data.cbSize = Marshal.SizeOf(data);
      for (int i = 0; SetupDiEnumDeviceInterfaces(lista, IntPtr.Zero, ref GUID_USBPRINT, i, ref data); i++) {
        int tam;
        SetupDiGetDeviceInterfaceDetail(lista, ref data, IntPtr.Zero, 0, out tam, IntPtr.Zero);
        IntPtr buf = Marshal.AllocHGlobal(tam);
        try {
          // cbSize de la estructura de detalle: 8 en 64 bits, 6 en 32 bits
          Marshal.WriteInt32(buf, IntPtr.Size == 8 ? 8 : 6);
          if (!SetupDiGetDeviceInterfaceDetail(lista, ref data, buf, tam, out tam, IntPtr.Zero)) throw new Win32Exception();
          rutas.Add(Marshal.PtrToStringUni(new IntPtr(buf.ToInt64() + 4)));
        } finally { Marshal.FreeHGlobal(buf); }
      }
    } finally { SetupDiDestroyDeviceInfoList(lista); }
    return rutas;
  }

  public static void Enviar(string dispositivo, byte[] bytes) {
    string ruta = null;
    foreach (string r in Listar()) {
      if (r.IndexOf(dispositivo, StringComparison.OrdinalIgnoreCase) >= 0) { ruta = r; break; }
    }
    if (ruta == null) throw new Exception("No encuentro la impresora: tiene que estar prendida y conectada por USB.");

    using (SafeFileHandle h = CreateFile(ruta, GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero)) {
      if (h.IsInvalid) throw new Win32Exception();
      using (FileStream salida = new FileStream(h, FileAccess.Write, 4096, false)) {
        salida.Write(bytes, 0, bytes.Length);
        salida.Flush();
      }
    }
  }
}
'@

try {
  [ImpresoraUsb]::Enviar($Dispositivo, [IO.File]::ReadAllBytes($Archivo))
} catch {
  # El mensaje de error llega a servidor.js por stderr
  $e = $_.Exception
  while ($e.InnerException) { $e = $e.InnerException }
  [Console]::Error.WriteLine($e.Message)
  exit 1
}
