function substractOneDay(fecha){
    let tomorrow = new Date(fecha);
    return new Date(tomorrow.setDate(tomorrow.getDate() - 1));
}

function diffHours(date1, date2){
    return Math.abs(date1 - date2) / 36e5;
}

function parseDate(date){
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const timeout = ms => new Promise(res => setTimeout(res, ms));

module.exports = {
    substractOneDay: substractOneDay,
    diffHours: diffHours,
    parseDate: parseDate,
    timeout: timeout
}


// USE [Hospital]
// GO

// /****** Object:  Table [dbo].[Personal_FichadasSync]    Script Date: 01/04/2020 13:15:00 ******/
// SET ANSI_NULLS ON
// GO

// SET QUOTED_IDENTIFIER ON
// GO

// CREATE TABLE [dbo].[Personal_FichadasSync](
// 	[id] [int] IDENTITY(1,1) NOT NULL,
// 	[idFichada] [int]  NOT NULL,
// 	[idAgente] [int] NOT NULL,
// 	[fecha] [datetime] NOT NULL,
// 	[esEntrada] [bit] NULL,
// 	[reloj] [int] NOT NULL,
// 	[format] [varchar](50) NULL,
// 	[data1] [nvarchar](30) NULL,
// 	[data2] [nvarchar](30) NULL,
//  CONSTRAINT [PK_Personal_FichadaSync] PRIMARY KEY CLUSTERED 
// (
// 	[id] ASC
// )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
// ) ON [PRIMARY]
// GO


// TRIGGER
// USE [Hospital]
// GO

// SET ANSI_NULLS ON
// GO

// SET QUOTED_IDENTIFIER ON
// GO

// -- ========================================================
// -- Author:		dnievas
// -- Create date: 01/04/2020
// -- Description:	Copia todos los valores insertados a la tabla Personal_FichadasSync
// -- ========================================================
// CREATE trigger [dbo].[trg_Copy_Fichadas] on [dbo].[Personal_FichadasTemp] for INSERT
// AS
// -- Inserta
// INSERT INTO dbo.Personal_FichadasSync
// SELECT * FROM inserted
// GO

