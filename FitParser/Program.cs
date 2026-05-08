using System;
using System.IO;
using Dynastream.Fit;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length == 0) {
            Console.WriteLine("Usage: FitParser <path-to-fit-file>");
            return;
        }
        var filePath = args[0];
        var decode = new Decode();
        decode.MesgEvent += (s, e) => {
            var msg = e.mesg;
            for(byte i=0; i<255; i++) {
                var f = msg.GetField(i);
                if (f != null && f.GetName() != null && f.GetName().Contains("lat")) {
                    var val = f.GetValue();
                    if (val != null && val.ToString() != "2147483647") {
                        Console.WriteLine($"Msg {msg.Name} Num {msg.Num} Field {f.GetName()}: {val}");
                    }
                }
            }
        };

        using (FileStream fitSource = new FileStream(filePath, FileMode.Open))
        {
            decode.Read(fitSource);
        }
    }
}
