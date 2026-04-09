using System;
using System.IO;
using Dynastream.Fit;

class Program
{
    static void Main(string[] args)
    {
        var filePath = @"C:\Users\eric31707\Downloads\22452024865\22452024865_ACTIVITY.fit";
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
