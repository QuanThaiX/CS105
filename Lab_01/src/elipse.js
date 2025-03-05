function EllipsePainter(context, width, height) {

    this.context = context;
    this.imageData = context.createImageData(width, height);
    this.points = [];
    this.now = [-1, -1];
    this.width = width;
    this.height = height;
    
    this.getPixelIndex = function(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height)
            return -1;
        return (x + y * width) << 2;
    }

    this.setPixel = function(x, y, rgba) {
        pixelIndex = this.getPixelIndex(x, y);
        if (pixelIndex == -1) return;
        for (var i = 0; i < 4; i++) {
            this.imageData.data[pixelIndex + i] = rgba[i];
        }
    }

    this.drawPoint = function(p, rgba){
        var x = p[0];
        var y = p[1];
        for (var i = -1; i <= 1; i++)
            for (var j = -1; j <= 1; j++)
                this.setPixel(x + i, y + j, rgba);
    }

    this.drawLine = function(center, p2, rgba) {
        var a = Math.abs(p2[0] - center[0]);
        var b = Math.abs(p2[1] - center[1]);
        var xc = center[0], yc = center[1];
        var x = 0, y = b;
        var a2 = a * a;
        var b2 = b * b;
        var d1 = b2 - a2 * b + 0.25 * a2;
        var dx = 2 * b2 * x;
        var dy = 2 * a2 * y;
        
        while (dx < dy) {
            this.setPixel(xc + x, yc + y, rgba);
            this.setPixel(xc - x, yc + y, rgba);
            this.setPixel(xc + x, yc - y, rgba);
            this.setPixel(xc - x, yc - y, rgba);
            
            if (d1 < 0) {
                x++;
                dx = 2 * b2 * x;
                d1 = d1 + dx + b2;
            } else {
                x++;
                y--;
                dx = 2 * b2 * x;
                dy = 2 * a2 * y;
                d1 = d1 + dx - dy + b2;
            }
        }
        
        var d2 = b2 * Math.pow(x + 0.5, 2) + a2 * Math.pow(y - 1, 2) - a2 * b2;
        while (y >= 0) {
            this.setPixel(xc + x, yc + y, rgba);
            this.setPixel(xc - x, yc + y, rgba);
            this.setPixel(xc + x, yc - y, rgba);
            this.setPixel(xc - x, yc - y, rgba);
            
            if (d2 > 0) {
                y--;
                dy = 2 * a2 * y;
                d2 = d2 - dy + a2;
            } else {
                x++;
                y--;
                dx = 2 * b2 * x;
                dy = 2 * a2 * y;
                d2 = d2 + dx - dy + a2;
            }
        }
    }

    this.drawBkg = function(rgba) {
        for (var i = 0; i < this.width; i++)
            for (var j = 0; j < this.height; j++)
                this.setPixel(i, j, rgba);
    }   

    this.clear = function() {
        this.points.length = 0;
        this.drawBkg(bgRgba);
        this.context.putImageData(this.imageData, 0, 0);
    }

    this.addPoint = function(p) {
        this.points.push(p);
    }

    this.draw = function(p) {
        var n = this.points.length;
        this.drawBkg(bgRgba);
        for (var i = 0; i < n; i++)
            this.drawPoint(this.points[i], pointRgba);
        for (var i = 0; i < n - 1; i++)
            this.drawLine(this.points[i], this.points[i + 1], lineRgba);
        if (n > 0 && (this.points[n - 1][0] != p[0] || this.points[n - 1][1] != p[1])) {
            this.drawLine(this.points[n - 1], p, vlineRgba);
        }
        this.context.putImageData(this.imageData, 0, 0);
    }

    this.clear();
    this.draw();
}